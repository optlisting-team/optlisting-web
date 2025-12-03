"""
OptListing - Supplier CSV Data Pipeline
공급처 CSV 데이터 파싱 및 DB 연동 모듈
"""

import csv
import io
import re
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from .models import Listing, SessionLocal


# ============================================================
# 1. Pydantic Schemas - CSV 유효성 검사
# ============================================================

class MatchStrategy(str, Enum):
    """매칭 전략 우선순위"""
    SKU_EXACT = "sku_exact"
    UPC_EXACT = "upc_exact"
    EAN_EXACT = "ean_exact"
    SKU_UPC_COMPOSITE = "sku_upc_composite"


class SupplierCSVRow(BaseModel):
    """공급처 CSV 행 스키마"""
    sku: Optional[str] = Field(None, description="SKU (Stock Keeping Unit)")
    upc: Optional[str] = Field(None, description="UPC 코드 (12자리)")
    ean: Optional[str] = Field(None, description="EAN 코드 (13자리)")
    supplier_name: str = Field(..., description="공급처 이름 (필수)")
    supplier_id: Optional[str] = Field(None, description="공급처 ID")
    cost_price: Optional[float] = Field(None, description="원가")
    product_name: Optional[str] = Field(None, description="상품명")
    
    @validator('sku', 'upc', 'ean', pre=True, always=True)
    def clean_identifiers(cls, v):
        """식별자 정리 - 공백, 특수문자 제거"""
        if v is None or v == '':
            return None
        # 공백 제거 및 대문자 변환
        cleaned = str(v).strip().upper()
        # 빈 문자열이면 None 반환
        return cleaned if cleaned else None
    
    @validator('upc')
    def validate_upc(cls, v):
        """UPC 유효성 검사 (12자리 숫자)"""
        if v is None:
            return None
        # 숫자만 추출
        digits_only = re.sub(r'\D', '', v)
        if len(digits_only) == 12:
            return digits_only
        # 11자리면 앞에 0 추가
        if len(digits_only) == 11:
            return '0' + digits_only
        return v  # 검증 실패해도 일단 저장
    
    @validator('ean')
    def validate_ean(cls, v):
        """EAN 유효성 검사 (13자리 숫자)"""
        if v is None:
            return None
        digits_only = re.sub(r'\D', '', v)
        if len(digits_only) == 13:
            return digits_only
        return v
    
    @validator('supplier_name')
    def validate_supplier_name(cls, v):
        """공급처 이름 정리"""
        if not v or not v.strip():
            raise ValueError('supplier_name은 필수입니다')
        return v.strip()


class CSVProcessingResult(BaseModel):
    """CSV 처리 결과"""
    total_rows: int = 0
    valid_rows: int = 0
    invalid_rows: int = 0
    matched_listings: int = 0
    updated_listings: int = 0
    unmatched_rows: int = 0
    errors: List[Dict[str, Any]] = []
    processing_time_ms: float = 0
    match_details: Dict[str, int] = {}  # 매칭 전략별 통계


# ============================================================
# 2. CSV Parser - 파일 파싱 및 유효성 검사
# ============================================================

class SupplierCSVParser:
    """공급처 CSV 파서"""
    
    # 지원하는 컬럼명 매핑 (다양한 CSV 형식 지원)
    COLUMN_MAPPINGS = {
        'sku': ['sku', 'SKU', 'Sku', 'item_sku', 'ItemSKU', 'product_sku', 'seller_sku', 'SellerSKU'],
        'upc': ['upc', 'UPC', 'Upc', 'upc_code', 'UPCCode', 'barcode', 'Barcode'],
        'ean': ['ean', 'EAN', 'Ean', 'ean_code', 'EANCode', 'ean13'],
        'supplier_name': ['supplier_name', 'SupplierName', 'supplier', 'Supplier', 'vendor', 'Vendor', 
                         'source', 'Source', 'wholesaler', 'Wholesaler', '공급처', '소싱처'],
        'supplier_id': ['supplier_id', 'SupplierID', 'SupplierId', 'vendor_id', 'VendorID'],
        'cost_price': ['cost_price', 'CostPrice', 'cost', 'Cost', 'wholesale_price', 'unit_cost', '원가'],
        'product_name': ['product_name', 'ProductName', 'title', 'Title', 'name', 'Name', 'item_name', '상품명']
    }
    
    def __init__(self, file_content: bytes, encoding: str = 'utf-8'):
        self.file_content = file_content
        self.encoding = encoding
        self.detected_columns: Dict[str, str] = {}
        
    def detect_delimiter(self, sample: str) -> str:
        """CSV 구분자 자동 감지"""
        delimiters = [',', '\t', ';', '|']
        counts = {d: sample.count(d) for d in delimiters}
        return max(counts, key=counts.get)
    
    def map_columns(self, headers: List[str]) -> Dict[str, str]:
        """CSV 헤더를 내부 필드명으로 매핑"""
        mapping = {}
        for internal_name, possible_names in self.COLUMN_MAPPINGS.items():
            for header in headers:
                header_clean = header.strip()
                if header_clean in possible_names or header_clean.lower() in [n.lower() for n in possible_names]:
                    mapping[internal_name] = header_clean
                    break
        return mapping
    
    def parse(self) -> Tuple[List[SupplierCSVRow], List[Dict[str, Any]]]:
        """
        CSV 파일 파싱
        Returns: (valid_rows, errors)
        """
        valid_rows: List[SupplierCSVRow] = []
        errors: List[Dict[str, Any]] = []
        
        try:
            # 인코딩 시도 (UTF-8 -> CP949 -> Latin-1)
            content_str = None
            for enc in ['utf-8', 'utf-8-sig', 'cp949', 'euc-kr', 'latin-1']:
                try:
                    content_str = self.file_content.decode(enc)
                    self.encoding = enc
                    break
                except UnicodeDecodeError:
                    continue
            
            if content_str is None:
                raise ValueError("CSV 파일 인코딩을 감지할 수 없습니다")
            
            # 구분자 감지
            sample = content_str[:2000]
            delimiter = self.detect_delimiter(sample)
            
            # CSV 파싱
            reader = csv.DictReader(io.StringIO(content_str), delimiter=delimiter)
            headers = reader.fieldnames or []
            
            if not headers:
                raise ValueError("CSV 파일에 헤더가 없습니다")
            
            # 컬럼 매핑
            self.detected_columns = self.map_columns(headers)
            
            if 'supplier_name' not in self.detected_columns:
                raise ValueError("필수 컬럼 'supplier_name'을 찾을 수 없습니다. "
                               f"감지된 컬럼: {headers}")
            
            # SKU, UPC, EAN 중 하나는 있어야 함
            has_identifier = any(k in self.detected_columns for k in ['sku', 'upc', 'ean'])
            if not has_identifier:
                raise ValueError("SKU, UPC, EAN 중 하나의 컬럼이 필요합니다. "
                               f"감지된 컬럼: {headers}")
            
            # 각 행 파싱
            for row_num, row in enumerate(reader, start=2):  # 헤더가 1행
                try:
                    # 매핑된 컬럼으로 데이터 추출
                    row_data = {}
                    for internal_name, csv_column in self.detected_columns.items():
                        row_data[internal_name] = row.get(csv_column, '').strip()
                    
                    # Pydantic 검증
                    validated_row = SupplierCSVRow(**row_data)
                    
                    # SKU/UPC/EAN 중 하나라도 있는지 확인
                    if not validated_row.sku and not validated_row.upc and not validated_row.ean:
                        raise ValueError("SKU, UPC, EAN 중 하나는 필수입니다")
                    
                    valid_rows.append(validated_row)
                    
                except Exception as e:
                    errors.append({
                        'row': row_num,
                        'data': dict(row),
                        'error': str(e)
                    })
            
            return valid_rows, errors
            
        except Exception as e:
            errors.append({
                'row': 0,
                'data': None,
                'error': f"파일 파싱 실패: {str(e)}"
            })
            return [], errors


# ============================================================
# 3. Data Matcher - DB 매칭 및 업데이트
# ============================================================

class SupplierDataMatcher:
    """공급처 데이터 매칭 엔진"""
    
    def __init__(self, session: Session, user_id: str):
        self.session = session
        self.user_id = user_id
        self.match_stats = {
            MatchStrategy.SKU_EXACT: 0,
            MatchStrategy.UPC_EXACT: 0,
            MatchStrategy.EAN_EXACT: 0,
            MatchStrategy.SKU_UPC_COMPOSITE: 0
        }
    
    def find_matching_listing(self, row: SupplierCSVRow) -> Optional[Listing]:
        """
        CSV 행과 매칭되는 Listing 찾기
        우선순위: SKU > UPC > EAN > SKU+UPC Composite
        """
        # 1. SKU 정확 매칭 (가장 높은 우선순위)
        if row.sku:
            listing = self.session.query(Listing).filter(
                and_(
                    Listing.user_id == self.user_id,
                    func.upper(Listing.sku) == row.sku.upper()
                )
            ).first()
            if listing:
                self.match_stats[MatchStrategy.SKU_EXACT] += 1
                return listing
        
        # 2. UPC 정확 매칭
        if row.upc:
            # UPC는 listings.upc 필드와 매칭
            listing = self.session.query(Listing).filter(
                and_(
                    Listing.user_id == self.user_id,
                    Listing.upc == row.upc
                )
            ).first()
            if listing:
                self.match_stats[MatchStrategy.UPC_EXACT] += 1
                return listing
        
        # 3. EAN 매칭 (UPC 필드에 저장되어 있을 수 있음)
        if row.ean:
            listing = self.session.query(Listing).filter(
                and_(
                    Listing.user_id == self.user_id,
                    Listing.upc == row.ean
                )
            ).first()
            if listing:
                self.match_stats[MatchStrategy.EAN_EXACT] += 1
                return listing
        
        # 4. Composite 매칭 (SKU + UPC 모두 일치)
        if row.sku and row.upc:
            listing = self.session.query(Listing).filter(
                and_(
                    Listing.user_id == self.user_id,
                    func.upper(Listing.sku) == row.sku.upper(),
                    Listing.upc == row.upc
                )
            ).first()
            if listing:
                self.match_stats[MatchStrategy.SKU_UPC_COMPOSITE] += 1
                return listing
        
        return None
    
    def update_listing_supplier(self, listing: Listing, row: SupplierCSVRow) -> bool:
        """Listing의 공급처 정보 업데이트"""
        try:
            listing.supplier_name = row.supplier_name
            
            if row.supplier_id:
                listing.supplier_id = row.supplier_id
            
            # analysis_meta JSONB에 추가 정보 저장
            if listing.analysis_meta is None:
                listing.analysis_meta = {}
            
            listing.analysis_meta['supplier_info'] = {
                'supplier_name': row.supplier_name,
                'supplier_id': row.supplier_id,
                'cost_price': row.cost_price,
                'matched_at': datetime.utcnow().isoformat(),
                'match_source': 'csv_upload'
            }
            
            # source 필드도 업데이트 (공급처 기반)
            if row.supplier_name:
                listing.source = row.supplier_name
            
            return True
        except Exception as e:
            print(f"Error updating listing {listing.id}: {e}")
            return False


# ============================================================
# 4. Main Processing Function
# ============================================================

def process_supplier_csv(
    file_content: bytes,
    user_id: str,
    dry_run: bool = False
) -> CSVProcessingResult:
    """
    공급처 CSV 파일 처리 메인 함수
    
    Args:
        file_content: CSV 파일 바이너리 컨텐츠
        user_id: 사용자 ID
        dry_run: True면 실제 DB 업데이트 없이 시뮬레이션
    
    Returns:
        CSVProcessingResult: 처리 결과
    """
    start_time = datetime.utcnow()
    result = CSVProcessingResult()
    
    # 1. CSV 파싱
    parser = SupplierCSVParser(file_content)
    valid_rows, parse_errors = parser.parse()
    
    result.total_rows = len(valid_rows) + len(parse_errors)
    result.valid_rows = len(valid_rows)
    result.invalid_rows = len(parse_errors)
    result.errors.extend(parse_errors)
    
    if not valid_rows:
        result.processing_time_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
        return result
    
    # 2. DB 매칭 및 업데이트
    session = SessionLocal()
    try:
        matcher = SupplierDataMatcher(session, user_id)
        
        for row in valid_rows:
            listing = matcher.find_matching_listing(row)
            
            if listing:
                result.matched_listings += 1
                
                if not dry_run:
                    if matcher.update_listing_supplier(listing, row):
                        result.updated_listings += 1
                else:
                    result.updated_listings += 1  # dry_run에서는 매칭=업데이트
            else:
                result.unmatched_rows += 1
                result.errors.append({
                    'row': 'N/A',
                    'data': {
                        'sku': row.sku,
                        'upc': row.upc,
                        'ean': row.ean,
                        'supplier_name': row.supplier_name
                    },
                    'error': '매칭되는 리스팅을 찾을 수 없습니다'
                })
        
        if not dry_run:
            session.commit()
        
        # 매칭 통계 저장
        result.match_details = {
            strategy.value: count 
            for strategy, count in matcher.match_stats.items()
        }
        
    except Exception as e:
        session.rollback()
        result.errors.append({
            'row': 'N/A',
            'data': None,
            'error': f"DB 처리 실패: {str(e)}"
        })
    finally:
        session.close()
    
    result.processing_time_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
    return result


# ============================================================
# 5. Bulk Update with Raw SQL (High Performance)
# ============================================================

def bulk_update_suppliers_sql(
    session: Session,
    user_id: str,
    csv_data: List[SupplierCSVRow]
) -> int:
    """
    대용량 CSV를 위한 Raw SQL 벌크 업데이트
    PostgreSQL의 UPDATE ... FROM 구문 사용
    
    Args:
        session: DB 세션
        user_id: 사용자 ID
        csv_data: 파싱된 CSV 데이터
    
    Returns:
        업데이트된 행 수
    """
    if not csv_data:
        return 0
    
    # VALUES 리스트 구성
    values_list = []
    for row in csv_data:
        sku = row.sku or ''
        upc = row.upc or ''
        supplier_name = row.supplier_name.replace("'", "''")  # SQL 인젝션 방지
        supplier_id = (row.supplier_id or '').replace("'", "''")
        values_list.append(f"('{sku}', '{upc}', '{supplier_name}', '{supplier_id}')")
    
    values_sql = ",\n".join(values_list)
    
    # Bulk UPDATE using PostgreSQL
    update_sql = f"""
    WITH supplier_data (csv_sku, csv_upc, supplier_name, supplier_id) AS (
        VALUES
        {values_sql}
    )
    UPDATE listings l
    SET 
        supplier_name = sd.supplier_name,
        supplier_id = NULLIF(sd.supplier_id, ''),
        source = sd.supplier_name,
        analysis_meta = COALESCE(l.analysis_meta, '{{}}'::jsonb) || 
            jsonb_build_object(
                'supplier_info', jsonb_build_object(
                    'supplier_name', sd.supplier_name,
                    'supplier_id', sd.supplier_id,
                    'matched_at', NOW()::text,
                    'match_source', 'csv_bulk_upload'
                )
            )
    FROM supplier_data sd
    WHERE l.user_id = '{user_id}'
      AND (
          (sd.csv_sku != '' AND UPPER(l.sku) = UPPER(sd.csv_sku))
          OR (sd.csv_upc != '' AND l.upc = sd.csv_upc)
      )
    """
    
    result = session.execute(update_sql)
    session.commit()
    
    return result.rowcount


# ============================================================
# 6. Sample CSV Template Generator
# ============================================================

def generate_csv_template() -> str:
    """
    공급처 CSV 템플릿 생성
    사용자가 다운로드하여 사용할 수 있는 샘플 CSV
    """
    template = """SKU,UPC,EAN,SupplierName,SupplierID,CostPrice,ProductName
ABC123,012345678901,,Amazon Wholesale,AMZ-001,15.99,Sample Product 1
DEF456,,4006381333931,CJ Dropshipping,CJ-002,8.50,Sample Product 2
GHI789,098765432109,,Walmart Supplier,WMT-003,22.00,Sample Product 3
,123456789012,,AliExpress Vendor,ALI-004,5.25,Sample Product 4
JKL012,,,Home Depot Direct,HD-005,45.00,Sample Product 5
"""
    return template


# ============================================================
# 7. Export: Unmatched Listings Report
# ============================================================

def get_unmatched_listings(
    session: Session,
    user_id: str,
    limit: int = 1000
) -> List[Dict[str, Any]]:
    """
    공급처 정보가 없는 리스팅 목록 조회
    사용자가 CSV에 추가해야 할 리스팅들
    """
    listings = session.query(Listing).filter(
        and_(
            Listing.user_id == user_id,
            or_(
                Listing.supplier_name.is_(None),
                Listing.supplier_name == '',
                Listing.supplier_name == 'Unknown'
            )
        )
    ).limit(limit).all()
    
    return [
        {
            'ebay_item_id': l.ebay_item_id,
            'sku': l.sku,
            'upc': l.upc,
            'title': l.title,
            'current_source': l.source,
            'is_zombie': l.is_zombie,
            'zombie_score': l.zombie_score
        }
        for l in listings
    ]

