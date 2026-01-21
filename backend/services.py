from datetime import date, timedelta, datetime
from typing import List, Optional, Dict, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, cast, Integer, String, Date, case, func
from sqlalchemy.dialects.postgresql import insert, JSONB
from .models import Listing, DeletionLog
import pandas as pd
from io import StringIO
import re
import json
import logging

# Initialize logger for this module
logger = logging.getLogger(__name__)


def detect_shopify_routing(
    sku: str = "",
    image_url: str = "",
    title: str = "",
    brand: str = ""
) -> bool:
    """
    Shopify 경유 여부 감지
    
    Returns: True if product goes through Shopify, False otherwise
    
    Detection Methods:
    1. SKU 패턴: "SHOP-", "SH-", "Shopify-", "SHOPIFY-"
    2. Image URL: shopify 관련 도메인 (cdn.shopify.com, *.myshopify.com)
    3. Title/Brand에 shopify 관련 키워드
    """
    sku_upper = sku.upper() if sku else ""
    image_url_lower = image_url.lower() if image_url else ""
    title_lower = title.lower() if title else ""
    brand_lower = brand.lower() if brand else ""
    
    # SKU 패턴 확인
    shopify_sku_patterns = ["SHOP-", "SH-", "SHOPIFY-", "SHOPIFY", "SHOP"]
    if any(sku_upper.startswith(pattern) for pattern in shopify_sku_patterns):
        return True
    
    # Image URL 패턴 확인
    shopify_url_patterns = [
        "cdn.shopify.com",
        ".myshopify.com",
        "shopifycdn.com",
        "shopify.com"
    ]
    if any(pattern in image_url_lower for pattern in shopify_url_patterns):
        return True
    
    # Title/Brand에 shopify 관련 키워드
    search_text = f"{title_lower} {brand_lower}".strip()
    shopify_keywords = ["shopify", "shopify store", "via shopify"]
    if any(keyword in search_text for keyword in shopify_keywords):
        return True
    
    return False


def extract_supplier_info(
    sku: str = "",
    image_url: str = "",
    title: str = "",
    brand: str = "",
    upc: str = ""
) -> Tuple[str, Optional[str]]:
    """
    Extract Supplier Name and Supplier ID from SKU and other data.
    
    Returns: (supplier_name, supplier_id)
    - supplier_name: Detected supplier name (e.g., "Amazon", "Walmart", "Unverified")
    - supplier_id: Extracted supplier ID (e.g., ASIN "B08...", Walmart ID) or None
    
    Logic:
    - Amazon: If SKU has "AMZ" or "B0..." pattern, extract ASIN -> save to supplier_id
    - Walmart: If SKU has "WM", extract the ID -> save to supplier_id
    - AliExpress/Others: Regex matching logic
    - Fallback: If unknown, set supplier_name="Unverified"
    
    Note: Shopify 경유 여부는 별도 함수 detect_shopify_routing()으로 감지
    """
    sku_upper = sku.upper() if sku else ""
    image_url_lower = image_url.lower() if image_url else ""
    title_lower = title.lower() if title else ""
    brand_lower = brand.lower() if brand else ""
    
    # SKU에서 공급처 힌트 추출 (더 정교한 파싱)
    # SKU 패턴 예시:
    # - "AMZ-B08ABC1234" → Amazon
    # - "WM-123456" → Walmart
    # - "AE-789012" → AliExpress
    # - "CJ-345678" → CJ Dropshipping
    # - "SHOP-AMZ-B08ABC1234" → Shopify 경유 Amazon
    # - "AUTODS-B08ABC1234" → AutoDS 사용
    # - "YABALLE-AMZ-123" → Yaballe 사용
    # - "B08ABC1234" → ASIN만 있으면 Amazon
    
    # SKU를 하이픈(-) 또는 언더스코어(_)로 분리하여 분석
    sku_parts = re.split(r'[-_]', sku_upper)
    
    # Amazon Detection
    # Pattern 1: SKU starts with "AMZ" or contains "B0" (ASIN pattern)
    amazon_asin_pattern = r'B0[0-9A-Z]{8}'  # ASIN format: B + 9 alphanumeric
    
    # Amazon SKU 패턴 (확장)
    amazon_sku_patterns = ["AMZ", "AMAZON", "AUTODS"]  # AutoDS도 보통 Amazon 제품
    amazon_in_sku = (
        sku_upper.startswith("AMZ") or
        any(part in amazon_sku_patterns for part in sku_parts) or
        re.search(amazon_asin_pattern, sku_upper)  # ASIN 패턴이 있으면 Amazon
    )
    
    # Amazon Image URL 패턴 (강화)
    amazon_url_patterns = [
        "ssl-images-amazon.com",
        "images-na.ssl-images-amazon.com",
        "m.media-amazon.com",
        "images.amazon.com",
        "amazon-adsystem.com"
    ]
    
    # Amazon Title/Brand 키워드
    amazon_keywords = ["amazon basics", "solimo", "happy belly"]
    
    # Amazon 감지 (우선순위: SKU > Image URL > Title/Brand)
    is_amazon = (
        amazon_in_sku or
        any(pattern in image_url_lower for pattern in amazon_url_patterns) or
        any(keyword in title_lower or keyword in brand_lower for keyword in amazon_keywords)
    )
    
    if is_amazon:
        # Extract ASIN
        asin_match = re.search(amazon_asin_pattern, sku_upper)
        if asin_match:
            supplier_id = asin_match.group(0)
        elif sku_upper.startswith("AMZ"):
            # Try to extract ASIN from SKU (e.g., "AMZ-B08ABC1234")
            parts = sku_upper.split("-")
            for part in parts:
                if re.match(amazon_asin_pattern, part):
                    supplier_id = part
                    break
            else:
                supplier_id = sku_upper.replace("AMZ", "").strip("-")
        else:
            supplier_id = None
        return ("Amazon", supplier_id)
    
    # Walmart Detection
    # Walmart SKU 패턴 (확장)
    walmart_sku_patterns = ["WM", "WALMART", "WMT"]
    walmart_in_sku = (
        sku_upper.startswith("WM") or
        any(part in walmart_sku_patterns for part in sku_parts)
    )
    
    # Walmart Image URL 패턴 (강화)
    walmart_url_patterns = [
        "walmartimages.com",
        "i5.walmartimages.com",
        "i.walmartimages.com",
        "walmart.com/images"
    ]
    
    # Walmart Title/Brand 키워드
    walmart_keywords = ["mainstays", "great value", "equate", "pen+gear", "pen & gear", "hyper tough"]
    
    is_walmart = (
        walmart_in_sku or
        any(pattern in image_url_lower for pattern in walmart_url_patterns) or
        any(keyword in title_lower or keyword in brand_lower for keyword in walmart_keywords)
    )
    
    if is_walmart:
        # Extract Walmart ID (usually after "WM-" prefix)
        if sku_upper.startswith("WM"):
            walmart_id = sku_upper.replace("WM", "").strip("-").strip()
            supplier_id = walmart_id if walmart_id else None
        else:
            supplier_id = None
        return ("Walmart", supplier_id)
    
    # AliExpress Detection
    # AliExpress SKU 패턴 (확장)
    aliexpress_sku_patterns = ["AE", "ALI", "ALIEXPRESS", "ALI-EXPRESS"]
    aliexpress_in_sku = (
        sku_upper.startswith("AE") or
        sku_upper.startswith("ALI") or
        any(part in aliexpress_sku_patterns for part in sku_parts)
    )
    
    # AliExpress Image URL 패턴 (강화)
    aliexpress_url_patterns = [
        "alicdn.com",
        "ae01.alicdn.com",
        "ae02.alicdn.com",
        "ae03.alicdn.com",
        "aliexpress.com"
    ]
    
    is_aliexpress = (
        aliexpress_in_sku or
        any(pattern in image_url_lower for pattern in aliexpress_url_patterns)
    )
    
    if is_aliexpress:
        # Extract AliExpress product ID
        if sku_upper.startswith("AE") or sku_upper.startswith("ALI"):
            ali_id = sku_upper.replace("AE", "").replace("ALI", "").strip("-").strip()
            supplier_id = ali_id if ali_id else None
        else:
            supplier_id = None
        return ("AliExpress", supplier_id)
    
    # CJ Dropshipping
    cj_sku_patterns = ["CJ", "CJDROPSHIPPING", "CJ-DROP"]
    cj_url_patterns = ["cjdropshipping.com", "cjdropshipping"]
    cj_in_sku = sku_upper.startswith("CJ") or any(part in cj_sku_patterns for part in sku_parts)
    if cj_in_sku or any(pattern in image_url_lower for pattern in cj_url_patterns):
        cj_id = sku_upper.replace("CJ", "").strip("-").strip() if sku_upper.startswith("CJ") else None
        return ("CJ Dropshipping", cj_id)
    
    # Home Depot
    hd_sku_patterns = ["HD", "HOMEDEPOT", "HOME-DEPOT"]
    hd_url_patterns = ["homedepot.com", "homedepot"]
    hd_keywords = ["husky", "hdx", "glacier bay"]
    hd_in_sku = sku_upper.startswith("HD") or any(part in hd_sku_patterns for part in sku_parts)
    is_hd = (
        hd_in_sku or
        any(pattern in image_url_lower for pattern in hd_url_patterns) or
        any(keyword in title_lower or keyword in brand_lower for keyword in hd_keywords)
    )
    if is_hd:
        hd_id = sku_upper.replace("HD", "").strip("-").strip() if sku_upper.startswith("HD") else None
        return ("Home Depot", hd_id)
    
    # Wayfair
    wf_sku_patterns = ["WF", "WAYFAIR"]
    wf_url_patterns = ["wayfair.com", "wayfair"]
    wf_keywords = ["wayfair basics", "mercury row"]
    wf_in_sku = sku_upper.startswith("WF") or any(part in wf_sku_patterns for part in sku_parts)
    is_wf = (
        wf_in_sku or
        any(pattern in image_url_lower for pattern in wf_url_patterns) or
        any(keyword in title_lower or keyword in brand_lower for keyword in wf_keywords)
    )
    if is_wf:
        wf_id = sku_upper.replace("WF", "").strip("-").strip() if sku_upper.startswith("WF") else None
        return ("Wayfair", wf_id)
    
    # Costco
    costco_sku_patterns = ["CO", "COSTCO"]
    costco_keywords = ["kirkland", "kirkland signature"]
    costco_in_sku = sku_upper.startswith("CO") or any(part in costco_sku_patterns for part in sku_parts)
    is_costco = (
        costco_in_sku or
        "costco.com" in image_url_lower or
        any(keyword in title_lower or keyword in brand_lower for keyword in costco_keywords)
    )
    if is_costco:
        co_id = sku_upper.replace("CO", "").strip("-").strip() if sku_upper.startswith("CO") else None
        return ("Costco", co_id)
    
    # Costway
    cw_sku_patterns = ["CW", "COSTWAY"]
    cw_in_sku = sku_upper.startswith("CW") or any(part in cw_sku_patterns for part in sku_parts)
    if cw_in_sku or "costway" in image_url_lower:
        cw_id = sku_upper.replace("CW", "").strip("-").strip() if sku_upper.startswith("CW") else None
        return ("Costway", cw_id)
    
    # ============================================
    # 자동화 툴 감지 (AutoDS, Yaballe 등)
    # 우선순위: 자동화 툴 > 공급처
    # ============================================
    
    # AutoDS 감지
    # AutoDS SKU 패턴: "AUTODS-", "ADS-", "AD-", "AUTODS", "AUTODS-AMZ-", "AUTODS-WM-"
    autods_sku_patterns = ["AUTODS", "ADS", "AD"]
    autods_in_sku = (
        sku_upper.startswith("AUTODS") or
        sku_upper.startswith("ADS") or
        sku_upper.startswith("AD-") or
        any(part in autods_sku_patterns for part in sku_parts)
    )
    
    # AutoDS Image URL 패턴
    autods_url_patterns = ["autods.com", "autods.io"]
    
    is_autods = (
        autods_in_sku or
        any(pattern in image_url_lower for pattern in autods_url_patterns) or
        "autods" in title_lower
    )
    
    if is_autods:
        # AutoDS SKU에서 실제 공급처 추출 시도 (예: "AUTODS-AMZ-B08ABC1234" → "B08ABC1234")
        # 패턴 분석: AutoDS 접두사 제거 후 남은 부분에서 실제 공급처 ID 추출
        # 지원 패턴: AUTODS-, ADS-, AD-, AL- (AutoDS의 일부 변형)
        remaining_sku = None
        if sku_upper.startswith("AUTODS"):
            remaining_sku = sku_upper.replace("AUTODS", "", 1).strip("-").strip()
        elif sku_upper.startswith("ADS-"):
            remaining_sku = sku_upper.replace("ADS-", "", 1).strip()
        elif sku_upper.startswith("ADS"):
            remaining_sku = sku_upper.replace("ADS", "", 1).strip("-").strip()
        elif sku_upper.startswith("AD-"):
            remaining_sku = sku_upper.replace("AD-", "", 1).strip()
        elif sku_upper.startswith("AL-") and not sku_upper.startswith("ALI"):  # AL-는 AutoDS 패턴, ALI-는 AliExpress
            remaining_sku = sku_upper.replace("AL-", "", 1).strip()
        
        # 남은 SKU에서 실제 공급처 ID 추출 (재귀적 파싱)
        supplier_id = None
        if remaining_sku:
            # 하이픈으로 분리된 부분들 분석
            remaining_parts = re.split(r'[-_]', remaining_sku)
            
            # Amazon ASIN 패턴 찾기 (B0으로 시작하는 10자리)
            amazon_asin_pattern = r'B0[0-9A-Z]{8}'
            asin_match = re.search(amazon_asin_pattern, remaining_sku)
            if asin_match:
                supplier_id = asin_match.group(0)
            # AMZ 접두사 제거 후 ASIN 찾기
            elif remaining_parts and remaining_parts[0] == "AMZ" and len(remaining_parts) > 1:
                # "AMZ-B08ABC1234" → "B08ABC1234"
                for part in remaining_parts[1:]:
                    if re.match(amazon_asin_pattern, part):
                        supplier_id = part
                        break
                if not supplier_id:
                    # ASIN 패턴이 없으면 나머지 부분을 ID로 사용
                    supplier_id = "-".join(remaining_parts[1:]) if len(remaining_parts) > 1 else None
            # Walmart 패턴 (WM 접두사 제거)
            elif remaining_parts and remaining_parts[0] in ["WM", "WMT", "WALMART"]:
                # "WM-123456" → "123456"
                supplier_id = "-".join(remaining_parts[1:]) if len(remaining_parts) > 1 else None
            # AliExpress 패턴 (AE, ALI 접두사 제거)
            elif remaining_parts and remaining_parts[0] in ["AE", "ALI", "ALIEXPRESS"]:
                # "AE-789012" → "789012"
                supplier_id = "-".join(remaining_parts[1:]) if len(remaining_parts) > 1 else None
            # 다른 공급처 패턴들
            elif remaining_parts and remaining_parts[0] in ["CJ", "HD", "WF", "CO", "CW", "BG"]:
                # "CJ-345678" → "345678"
                supplier_id = "-".join(remaining_parts[1:]) if len(remaining_parts) > 1 else None
            else:
                # 패턴이 없으면 전체를 ID로 사용 (단, AutoDS 접두사는 제외)
                supplier_id = remaining_sku if remaining_sku else None
        
        return ("AutoDS", supplier_id)
    
    # Yaballe 감지
    # Yaballe SKU 패턴: "YAB-", "YB-", "YABALLE-", "YABALLE", "YABALLE-AMZ-"
    yaballe_sku_patterns = ["YABALLE", "YAB", "YB"]
    yaballe_in_sku = (
        sku_upper.startswith("YABALLE") or
        sku_upper.startswith("YAB-") or
        sku_upper.startswith("YB-") or
        any(part in yaballe_sku_patterns for part in sku_parts)
    )
    
    yaballe_url_patterns = ["yaballe.com", "yaballe.io"]
    
    is_yaballe = (
        yaballe_in_sku or
        any(pattern in image_url_lower for pattern in yaballe_url_patterns) or
        "yaballe" in title_lower
    )
    
    if is_yaballe:
        # Yaballe SKU에서 실제 공급처 추출 시도 (예: "YABALLE-AMZ-B08ABC1234" → "B08ABC1234")
        # 패턴 분석: Yaballe 접두사 제거 후 남은 부분에서 실제 공급처 ID 추출
        remaining_sku = None
        if sku_upper.startswith("YABALLE"):
            remaining_sku = sku_upper.replace("YABALLE", "", 1).strip("-").strip()
        elif sku_upper.startswith("YAB-"):
            remaining_sku = sku_upper.replace("YAB-", "", 1).strip()
        elif sku_upper.startswith("YB-"):
            remaining_sku = sku_upper.replace("YB-", "", 1).strip()
        elif sku_upper.startswith("YAB"):
            remaining_sku = sku_upper.replace("YAB", "", 1).strip("-").strip()
        elif sku_upper.startswith("YB"):
            remaining_sku = sku_upper.replace("YB", "", 1).strip("-").strip()
        
        # 남은 SKU에서 실제 공급처 ID 추출 (재귀적 파싱)
        supplier_id = None
        if remaining_sku:
            # 하이픈으로 분리된 부분들 분석
            remaining_parts = re.split(r'[-_]', remaining_sku)
            
            # Amazon ASIN 패턴 찾기 (B0으로 시작하는 10자리)
            amazon_asin_pattern = r'B0[0-9A-Z]{8}'
            asin_match = re.search(amazon_asin_pattern, remaining_sku)
            if asin_match:
                supplier_id = asin_match.group(0)
            # AMZ 접두사 제거 후 ASIN 찾기
            elif remaining_parts and remaining_parts[0] == "AMZ" and len(remaining_parts) > 1:
                # "AMZ-B08ABC1234" → "B08ABC1234"
                for part in remaining_parts[1:]:
                    if re.match(amazon_asin_pattern, part):
                        supplier_id = part
                        break
                if not supplier_id:
                    # ASIN 패턴이 없으면 나머지 부분을 ID로 사용
                    supplier_id = "-".join(remaining_parts[1:]) if len(remaining_parts) > 1 else None
            # Walmart 패턴 (WM 접두사 제거)
            elif remaining_parts and remaining_parts[0] in ["WM", "WMT", "WALMART"]:
                # "WM-123456" → "123456"
                supplier_id = "-".join(remaining_parts[1:]) if len(remaining_parts) > 1 else None
            # AliExpress 패턴 (AE, ALI 접두사 제거)
            elif remaining_parts and remaining_parts[0] in ["AE", "ALI", "ALIEXPRESS"]:
                # "AE-789012" → "789012"
                supplier_id = "-".join(remaining_parts[1:]) if len(remaining_parts) > 1 else None
            # 다른 공급처 패턴들
            elif remaining_parts and remaining_parts[0] in ["CJ", "HD", "WF", "CO", "CW", "BG"]:
                # "CJ-345678" → "345678"
                supplier_id = "-".join(remaining_parts[1:]) if len(remaining_parts) > 1 else None
            else:
                # 패턴이 없으면 전체를 ID로 사용 (단, Yaballe 접두사는 제외)
                supplier_id = remaining_sku if remaining_sku else None
        
        return ("Yaballe", supplier_id)
    
    # Pro Aggregators
    w2b_sku_patterns = ["W2B", "WHOLESALE2B", "WHOLESALE-2B"]
    w2b_in_sku = sku_upper.startswith("W2B") or any(part in w2b_sku_patterns for part in sku_parts)
    if w2b_in_sku or "wholesale2b" in image_url_lower:
        w2b_id = sku_upper.replace("W2B", "").strip("-").strip() if sku_upper.startswith("W2B") else None
        return ("Wholesale2B", w2b_id)
    
    spk_sku_patterns = ["SPK", "SPOCKET"]
    spk_in_sku = sku_upper.startswith("SPK") or any(part in spk_sku_patterns for part in sku_parts)
    if spk_in_sku or "spocket" in image_url_lower:
        spk_id = sku_upper.replace("SPK", "").strip("-").strip() if sku_upper.startswith("SPK") else None
        return ("Spocket", spk_id)
    
    # SaleHoo (주의: "SH"는 Shopify와 겹칠 수 있으므로 더 구체적인 패턴 필요)
    salehoo_sku_patterns = ["SH", "SALEHOO", "SALE-HOO"]
    salehoo_in_sku = (
        (sku_upper.startswith("SH") and not any(shopify_part in sku_parts for shopify_part in ["SHOP", "SHOPIFY"])) or
        any(part in salehoo_sku_patterns for part in sku_parts)
    )
    if salehoo_in_sku or "salehoo" in image_url_lower:
        sh_id = sku_upper.replace("SH", "").strip("-").strip() if sku_upper.startswith("SH") else None
        return ("SaleHoo", sh_id)
    
    is_sku_patterns = ["IS", "INVENTORYSOURCE", "INVENTORY-SOURCE"]
    is_in_sku = sku_upper.startswith("IS") or any(part in is_sku_patterns for part in sku_parts)
    if is_in_sku or "inventorysource" in image_url_lower:
        is_id = sku_upper.replace("IS", "").strip("-").strip() if sku_upper.startswith("IS") else None
        return ("Inventory Source", is_id)
    
    df_sku_patterns = ["DF", "DROPIFIED"]
    df_in_sku = sku_upper.startswith("DF") or any(part in df_sku_patterns for part in sku_parts)
    if df_in_sku or "dropified" in image_url_lower:
        df_id = sku_upper.replace("DF", "").strip("-").strip() if sku_upper.startswith("DF") else None
        return ("Dropified", df_id)
    
    # Fallback: Unverified
    return ("Unverified", None)


def detect_source(
    image_url: str = "",
    sku: str = "",
    title: str = "",
    brand: str = "",
    upc: str = ""
) -> tuple[str, str]:
    """
    Legacy function - kept for backward compatibility.
    Now uses extract_supplier_info internally.
    """
    supplier_name, _ = extract_supplier_info(sku, image_url, title, brand, upc)
    # Return with confidence level for backward compatibility
    confidence = "High" if supplier_name != "Unverified" else "Low"
    return (supplier_name, confidence)
    """
    Advanced Source Detection with Forensic Analysis
    Uses multiple data points to identify source with confidence scoring.
    
    Detection Methods (in priority order):
    1. Exclusive Brand/Keyword Match (HIGH confidence)
    2. SKU Prefix Match (HIGH confidence)
    3. UPC/EAN Prefix Match (HIGH confidence)
    4. Image URL Domain Match (MEDIUM confidence)
    
    Returns: (source, confidence_level)
    - source: Detected source name or "Unverified"
    - confidence_level: "High", "Medium", "Low"
    """
    image_url_lower = image_url.lower() if image_url else ""
    sku_upper = sku.upper() if sku else ""
    title_lower = title.lower() if title else ""
    brand_lower = brand.lower() if brand else ""
    upc_str = upc.strip() if upc else ""
    
    # Exclusive Brand/Keyword Dictionary (HIGH confidence indicators)
    exclusive_brands = {
        "Walmart": ["mainstays", "great value", "equate", "pen+gear", "pen & gear", "hyper tough"],
        "Costco": ["kirkland", "kirkland signature"],
        "Amazon": ["amazonbasics", "solimo", "happy belly"],
        "Home Depot": ["husky", "hdx", "glacier bay"],
        "Wayfair": ["wayfair basics", "mercury row"]
    }
    
    # SKU Prefix Patterns (HIGH confidence)
    sku_patterns = {
        "Amazon": ["AMZ"],
        "Walmart": ["WM"],
        "AliExpress": ["AE", "ALI"],
        "CJ Dropshipping": ["CJ"],
        "Home Depot": ["HD"],
        "Wayfair": ["WF"],
        "Costco": ["CO"],
        "Wholesale2B": ["W2B"],
        "Spocket": ["SPK"],
        "SaleHoo": ["SH"],
        "Inventory Source": ["IS"],
        "Dropified": ["DF"]
    }
    
    # UPC/EAN Prefix Patterns (HIGH confidence)
    # Real implementation would query UPC database
    upc_patterns = {
        "Walmart": ["681131"],  # Walmart UPC prefix
        # Add more UPC prefixes as needed
    }
    
    # Image URL Domain Patterns (MEDIUM confidence)
    url_patterns = {
        "Amazon": ["amazon", "ssl-images-amazon"],
        "Walmart": ["walmart", "walmartimages"],
        "AliExpress": ["alicdn", "aliexpress"],
        "CJ Dropshipping": ["cjdropshipping"],
        "Home Depot": ["homedepot"],
        "Wayfair": ["wayfair"],
        "Costco": ["costco"],
        "Wholesale2B": ["wholesale2b"],
        "Spocket": ["spocket"],
        "SaleHoo": ["salehoo"],
        "Inventory Source": ["inventorysource"],
        "Dropified": ["dropified"]
    }
    
    # Priority 1: Check Exclusive Brands/Keywords (HIGH confidence)
    # Check both title and brand field
    search_text = f"{title_lower} {brand_lower}".strip()
    for source, keywords in exclusive_brands.items():
        for keyword in keywords:
            if keyword in search_text:
                return (source, "High")
    
    # Priority 2: Check SKU Prefix (HIGH confidence)
    for source, prefixes in sku_patterns.items():
        if any(sku_upper.startswith(prefix) for prefix in prefixes):
            return (source, "High")
    
    # Priority 3: Check UPC/EAN Prefix (HIGH confidence)
    if upc_str:
        for source, prefixes in upc_patterns.items():
            if any(upc_str.startswith(prefix) for prefix in prefixes):
                return (source, "High")
    
    # Priority 4: Check Image URL Domain (MEDIUM confidence)
    if image_url_lower:
        for source, keywords in url_patterns.items():
            if any(keyword in image_url_lower for keyword in keywords):
                return (source, "Medium")
    
    # No match found -> Unverified (LOW confidence)
    return ("Unverified", "Low")


def check_global_health(
    db: Session,
    user_id: str,
    supplier_id: Optional[str]
) -> bool:
    """
    Cross-Platform Health Check: Detect "Global Winners"
    
    Checks if a supplier_id is selling well across ALL of the user's connected stores
    (regardless of platform). This prevents accidental deletion of profitable items
    that are failing locally but succeeding globally.
    
    Args:
        db: Database session
        user_id: User ID to check across all their stores
        supplier_id: Supplier ID to check (e.g., ASIN "B08...", Walmart ID, etc.)
    
    Returns:
        True if SUM(sales) > 20 across all stores (Global Winner), False otherwise
    
    Logic:
        - Sum sales volume for the given supplier_id across ALL stores/platforms for this user
        - If total sales > 20 (threshold), return True (Global Winner)
        - Uses metrics['sales'] or legacy sold_qty field
    """
    if not supplier_id:
        return False
    
    # Query all listings for this user with matching supplier_id across ALL stores/platforms
    query = db.query(Listing).filter(
        Listing.user_id == user_id,
        Listing.supplier_id == supplier_id
    )
    
    all_listings = query.all()
    
    # Sum sales across all listings for this supplier_id
    total_sales = 0
    for listing in all_listings:
        # Try metrics['sales'] first, then fallback to sold_qty
        if listing.metrics and isinstance(listing.metrics, dict) and 'sales' in listing.metrics:
            sales = listing.metrics.get('sales', 0)
            if isinstance(sales, (int, float)):
                total_sales += int(sales)
        elif hasattr(listing, 'sold_qty') and listing.sold_qty:
            total_sales += listing.sold_qty or 0
    
    # Threshold: 20 sales across all platforms = Global Winner
    return total_sales > 20


def analyze_zombie_listings(
    db: Session,
    user_id: str,
    min_days: int = 7,               # Legacy: analytics_period_days
    max_sales: int = 0,              # 2. 기간 내 판매 건수
    max_watch_count: int = 0,        # Legacy: max_watches
    max_watches: int = 0,            # 3. 찜하기 (Watch)
    max_impressions: int = 100,      # 4. 총 노출 횟수
    max_views: int = 10,             # 5. 총 조회 횟수
    supplier_filter: str = "All",
    platform_filter: str = "eBay",   # MVP Scope: Default to eBay (only eBay and Shopify supported)
    store_id: Optional[str] = None,
    skip: int = 0,                   # Pagination: skip N records
    limit: int = 100                 # Pagination: limit to N records
) -> Tuple[List[Listing], Dict[str, int]]:
    """
    OptListing 최종 좀비 분석 필터
    순서: 판매(Sales) → 관심(Watch) → 트래픽(Traffic)
    
    필터 순서 (eBay 셀러의 자연스러운 판단 흐름):
    1. analytics_period_days (min_days): 분석 기준 기간 (기본 7일)
    2. max_sales: 기간 내 판매 건수 (기본 0건 = No Sale)
    3. max_watches: 찜하기/Watch (기본 0건)
    4. max_impressions: 총 노출 횟수 (기본 100회 미만)
    5. max_views: 총 조회 횟수 (기본 10회 미만)
    
    Uses metrics JSONB field for flexible filtering:
    - metrics['sales']['total_sales'] or metrics['sales']
    - metrics['watches']['total_watches'] or metrics['watches']
    - metrics['impressions']['total_impressions'] or metrics['impressions']
    - metrics['views']['total_views'] or metrics['views']
    
    Returns:
        Tuple of (list of zombie listings, breakdown dictionary by platform)
        Example: ([Listing, ...], {"eBay": 150, "Shopify": 23})
    """
    # Ensure values are non-negative
    min_days = max(0, min_days)
    max_sales = max(0, max_sales)
    # Use max_watches if provided, otherwise fall back to max_watch_count (legacy)
    effective_max_watches = max(0, max_watches if max_watches > 0 else max_watch_count)
    max_impressions = max(0, max_impressions)
    max_views = max(0, max_views)
    
    # ✅ 날짜 필터: min_days 이상 등록된 것만 포함 (예: 7일 이상)
    # 예: 오늘이 12월 13일이고 min_days=7이면, cutoff_date = 12월 6일
    # date_listed < 12월 6일 = 12월 6일 이전에 등록된 것 = 7일 이상 등록된 것만 포함
    cutoff_date = date.today() - timedelta(days=min_days)
    
    # Build query with filters
    # Support both new metrics JSONB and legacy fields
    query = db.query(Listing).filter(
        Listing.user_id == user_id
    )
    
    # Apply store filter if store_id is provided and not 'all'
    if store_id and store_id != 'all':
        # Note: Assuming there's a store_id column in Listing model
        # If not, this will need to be adjusted based on actual schema
        # For now, we'll skip this filter if store_id column doesn't exist
        if hasattr(Listing, 'store_id'):
            query = query.filter(Listing.store_id == store_id)
    # If store_id is 'all' or None, DO NOT filter by store (return all for user)
    
    # Date filter: use metrics['date_listed'] (JSONB) or fallback to date_listed/last_synced_at
    # ✅ FIX: JSONB 연산자 안전하게 처리 및 NULL 체크 강화
    date_filters = []
    
    # Use metrics JSONB if available (안전한 방식)
    # ✅ FIX: hasattr 제거 (SQL 쿼리 레벨에서 의미 없음), NULL 체크 강화
    date_filters.append(
        and_(
            Listing.metrics.isnot(None),
            Listing.metrics.has_key('date_listed'),
            # ✅ FIX: jsonb_typeof으로 타입 확인 후 안전하게 추출
            or_(
                # JSONB 값이 문자열인 경우
                and_(
                    func.jsonb_typeof(Listing.metrics['date_listed']) == 'string',
                    Listing.metrics['date_listed'].astext.isnot(None),
                    cast(Listing.metrics['date_listed'].astext, Date) < cutoff_date
                ),
                # JSONB 값이 숫자(타임스탬프)인 경우
                and_(
                    func.jsonb_typeof(Listing.metrics['date_listed']) == 'number',
                    Listing.metrics['date_listed'].astext.isnot(None),
                    cast(
                        func.to_timestamp(cast(Listing.metrics['date_listed'].astext, Integer)),
                        Date
                    ) < cutoff_date
                )
            )
        )
    )
    
    # Add fallback to date_listed if column exists (legacy support)
    date_filters.append(
        and_(
            or_(
                Listing.metrics == None,
                ~Listing.metrics.has_key('date_listed')
            ),
            Listing.date_listed.isnot(None),
            Listing.date_listed < cutoff_date
        )
    )
    
    # Add last_synced_at as final fallback
    date_filters.append(
        and_(
            or_(
                Listing.metrics == None,
                ~Listing.metrics.has_key('date_listed')
            ),
            or_(
                Listing.date_listed == None,
                Listing.date_listed.is_(None)
            ),
            Listing.last_synced_at.isnot(None),
            func.date(Listing.last_synced_at) < cutoff_date
        )
    )
    
    # 날짜 필터가 하나라도 있으면 적용
    if date_filters:
        query = query.filter(or_(*date_filters))
    
    # Sales filter: use metrics['sales'] (JSONB) with robust casting
    # ✅ FIX: JSONB 연산자 안전하게 처리 및 타입 검증 추가
    # ✅ FIX: metrics가 없을 때 직접 필드(quantity_sold, sold_qty)를 fallback으로 사용
    if max_sales is not None and max_sales >= 0:
        # Use CASE to safely handle NULL metrics or missing keys
        sales_value = case(
            (
                and_(
                    Listing.metrics.isnot(None),
                    Listing.metrics.has_key('sales'),
                    func.jsonb_typeof(Listing.metrics['sales']).in_(['number', 'string']),
                    Listing.metrics['sales'].astext.isnot(None)
                ),
                cast(Listing.metrics['sales'].astext, Integer)
            ),
            # Fallback to direct fields: quantity_sold or sold_qty
            else_=func.coalesce(
                func.coalesce(Listing.quantity_sold, 0),
                func.coalesce(Listing.sold_qty, 0),
                0
            )
        )
        query = query.filter(sales_value <= max_sales)
    
    # 3. Watch/찜하기 필터: metrics['watches'] or metrics['watches']['total_watches']
    if effective_max_watches is not None and effective_max_watches >= 0:
        watches_value = case(
            # Try nested structure first: metrics['watches']['total_watches']
            (
                and_(
                    Listing.metrics.isnot(None),
                    Listing.metrics.has_key('watches'),
                    func.jsonb_typeof(Listing.metrics['watches']) == 'object',
                    Listing.metrics['watches'].has_key('total_watches')
                ),
                cast(Listing.metrics['watches']['total_watches'].astext, Integer)
            ),
            # Then try flat structure: metrics['watches']
            (
                and_(
                    Listing.metrics.isnot(None),
                    Listing.metrics.has_key('watches'),
                    func.jsonb_typeof(Listing.metrics['watches']).in_(['number', 'string']),
                    Listing.metrics['watches'].astext.isnot(None)
                ),
                cast(Listing.metrics['watches'].astext, Integer)
            ),
            # Fallback to legacy watch_count column
            else_=func.coalesce(Listing.watch_count, 0)
        )
        query = query.filter(watches_value <= effective_max_watches)
    
    # 4. Impressions/노출 필터: metrics['impressions'] or metrics['impressions']['total_impressions']
    # ✅ FIX: metrics에 impressions가 없으면 필터를 적용하지 않음 (모든 항목 포함)
    if max_impressions is not None and max_impressions > 0:
        # metrics에 impressions가 있는 항목만 필터링
        impressions_filter = or_(
            # Nested structure: metrics['impressions']['total_impressions']
            and_(
                Listing.metrics.isnot(None),
                Listing.metrics.has_key('impressions'),
                func.jsonb_typeof(Listing.metrics['impressions']) == 'object',
                Listing.metrics['impressions'].has_key('total_impressions'),
                cast(Listing.metrics['impressions']['total_impressions'].astext, Integer) < max_impressions
            ),
            # Flat structure: metrics['impressions']
            and_(
                Listing.metrics.isnot(None),
                Listing.metrics.has_key('impressions'),
                func.jsonb_typeof(Listing.metrics['impressions']).in_(['number', 'string']),
                Listing.metrics['impressions'].astext.isnot(None),
                cast(Listing.metrics['impressions'].astext, Integer) < max_impressions
            ),
            # metrics에 impressions가 없으면 필터를 통과 (모든 항목 포함)
            or_(
                Listing.metrics == None,
                ~Listing.metrics.has_key('impressions')
            )
        )
        query = query.filter(impressions_filter)
    
    # 5. Views/조회 필터: metrics['views'] or metrics['views']['total_views']
    # ✅ FIX: metrics가 없을 때 직접 필드(view_count, views)를 fallback으로 사용
    if max_views is not None and max_views > 0:
        views_value = case(
            # Try nested structure first
            (
                and_(
                    Listing.metrics.isnot(None),
                    Listing.metrics.has_key('views'),
                    func.jsonb_typeof(Listing.metrics['views']) == 'object',
                    Listing.metrics['views'].has_key('total_views')
                ),
                cast(Listing.metrics['views']['total_views'].astext, Integer)
            ),
            # Then try flat structure
            (
                and_(
                    Listing.metrics.isnot(None),
                    Listing.metrics.has_key('views'),
                    func.jsonb_typeof(Listing.metrics['views']).in_(['number', 'string']),
                    Listing.metrics['views'].astext.isnot(None)
                ),
                cast(Listing.metrics['views'].astext, Integer)
            ),
            # Fallback to direct fields: view_count (Listing 모델에 정의된 필드)
            # ✅ FIX: view_count 필드 사용 (Listing 모델에 정의됨)
            else_=func.coalesce(Listing.view_count, 0)
        )
        query = query.filter(views_value < max_views)
    
    # Apply platform filter (MVP Scope: Only eBay and Shopify)
    # ✅ FIX: platform 필드가 없으면 marketplace 사용
    if platform_filter and platform_filter in ["eBay", "Shopify"]:
        # platform 필드가 있으면 사용, 없으면 marketplace 사용
        if hasattr(Listing, 'platform'):
            query = query.filter(Listing.platform == platform_filter)
        else:
            query = query.filter(Listing.marketplace == platform_filter)
    
    # Apply supplier filter if not "All"
    if supplier_filter and supplier_filter != "All":
        query = query.filter(Listing.supplier_name == supplier_filter)
    
    # Apply pagination (skip and limit)
    skip = max(0, skip)
    limit = min(max(1, limit), 1000)  # Clamp between 1 and 1000
    zombies = query.offset(skip).limit(limit).all()
    
    # Get current platform(s) being analyzed
    current_platforms = set()
    if platform_filter and platform_filter != "All":
        current_platforms.add(platform_filter)
    else:
        # If filtering all platforms, get all platforms from zombies
        # ✅ FIX: platform 필드가 없으면 marketplace 사용
        for z in zombies:
            platform = getattr(z, 'platform', None) or getattr(z, 'marketplace', None) or "Unknown"
            current_platforms.add(platform)
    
    # Cross-Platform Health Check & Activity Check: Check each zombie
    for zombie in zombies:
        # Check if this supplier_id is a global winner across all stores
        is_global_winner = check_global_health(db, user_id, zombie.supplier_id)
        
        # Set the is_global_winner flag (safe: check if column exists)
        if hasattr(zombie, 'is_global_winner'):
            zombie.is_global_winner = 1 if is_global_winner else 0
        
        # Cross-Platform Activity Check: Check if this zombie is active elsewhere
        is_active_elsewhere = False
        if zombie.supplier_id:
            # Find all other listings with the same supplier_id in OTHER platforms
            # ✅ FIX: platform 필드가 없으면 marketplace 사용
            zombie_platform = getattr(zombie, 'platform', None) or getattr(zombie, 'marketplace', None)
            if hasattr(Listing, 'platform'):
                other_listings_query = db.query(Listing).filter(
                    Listing.user_id == user_id,
                    Listing.supplier_id == zombie.supplier_id,
                    Listing.platform != zombie_platform  # Different platform/store
                )
            else:
                other_listings_query = db.query(Listing).filter(
                    Listing.user_id == user_id,
                    Listing.supplier_id == zombie.supplier_id,
                    Listing.marketplace != zombie_platform  # Different platform/store
                )
            other_listings = other_listings_query.all()
            
            # Check if ANY of these other listings are NOT zombies (active)
            for other_listing in other_listings:
                # Get sales, views, and age
                other_sales = 0
                other_views = 0
                other_date_listed = None
                
                if other_listing.metrics and isinstance(other_listing.metrics, dict):
                    other_sales = other_listing.metrics.get('sales', 0) or 0
                    other_views = other_listing.metrics.get('views', 0) or 0
                    if 'date_listed' in other_listing.metrics:
                        date_val = other_listing.metrics['date_listed']
                        if isinstance(date_val, date):
                            other_date_listed = date_val
                        elif isinstance(date_val, str):
                            try:
                                other_date_listed = datetime.strptime(date_val, '%Y-%m-%d').date()
                            except:
                                pass
                else:
                    other_sales = getattr(other_listing, 'sold_qty', 0) or 0
                    other_views = getattr(other_listing, 'watch_count', 0) or 0
                    other_date_listed = getattr(other_listing, 'date_listed', None)
                
                # Calculate age
                if other_date_listed:
                    age_days = (date.today() - other_date_listed).days
                else:
                    # Use last_synced_at as fallback
                    if other_listing.last_synced_at:
                        age_days = (date.today() - other_listing.last_synced_at.date()).days
                    else:
                        age_days = 999  # Very old if no date
                
                # Check if this listing is NOT a zombie (active)
                # Active if: Sales > 0 OR Views > 10 OR Age < 3 days
                is_active = (
                    other_sales > 0 or
                    other_views > 10 or
                    age_days < 3
                )
                
                if is_active:
                    is_active_elsewhere = True
                    break  # Found at least one active listing elsewhere
        
        # Set the is_active_elsewhere flag (safe: check if column exists)
        if hasattr(zombie, 'is_active_elsewhere'):
            zombie.is_active_elsewhere = 1 if is_active_elsewhere else 0
        
        # Commit the update to database (only if columns exist)
        try:
            db.commit()
        except Exception as e:
            # If commit fails due to missing columns, rollback and continue
            db.rollback()
            print(f"Warning: Could not update flags (columns may not exist): {e}")
    
    # Sort zombies: Primary by is_active_elsewhere (DESC - True first), Secondary by age (oldest first)
    def sort_key(z):
        # Primary: is_active_elsewhere (True = 1, False = 0, so DESC means True comes first)
        # Secondary: age (oldest first)
        is_active = getattr(z, 'is_active_elsewhere', 0)
        
        # Calculate age for secondary sort
        z_date_listed = None
        if z.metrics and isinstance(z.metrics, dict) and 'date_listed' in z.metrics:
            date_val = z.metrics['date_listed']
            if isinstance(date_val, date):
                z_date_listed = date_val
            elif isinstance(date_val, str):
                try:
                    z_date_listed = datetime.strptime(date_val, '%Y-%m-%d').date()
                except:
                    pass
        if not z_date_listed:
            z_date_listed = getattr(z, 'date_listed', None)
        if not z_date_listed and z.last_synced_at:
            z_date_listed = z.last_synced_at.date()
        
        age_days = (date.today() - z_date_listed).days if z_date_listed else 999
        
        # Return tuple: (negative is_active for DESC, age_days for ASC)
        return (-is_active, age_days)
    
    zombies = sorted(zombies, key=sort_key)
    
    # Calculate Store-Level Breakdown: Group zombies by platform
    zombie_breakdown = {}
    for zombie in zombies:
        # ✅ FIX: platform 필드가 없으면 marketplace 사용
        platform = getattr(zombie, 'platform', None) or getattr(zombie, 'marketplace', None) or "Unknown"
        zombie_breakdown[platform] = zombie_breakdown.get(platform, 0) + 1
    
    return zombies, zombie_breakdown


def count_low_performing_candidates(
    db: Session,
    user_id: str,
    min_days: int = 7,
    max_sales: int = 0,
    max_watch_count: int = 0,
    max_watches: int = 0,
    max_impressions: int = 100,
    max_views: int = 10,
    supplier_filter: str = "All",
    platform_filter: str = "eBay",
    store_id: Optional[str] = None
) -> int:
    """
    분석 대상 SKU 수 계산 (필터 조건에 맞는 active listings 수)
    
    analyze_zombie_listings와 동일한 필터 로직을 사용하되, count만 반환합니다.
    실제 분석을 수행하지 않으므로 크레딧을 차감하지 않습니다.
    
    Returns:
        int: 필터 조건에 맞는 분석 대상 SKU 수
    """
    # Ensure values are non-negative
    min_days = max(0, min_days)
    max_sales = max(0, max_sales)
    effective_max_watches = max(0, max_watches if max_watches > 0 else max_watch_count)
    max_impressions = max(0, max_impressions)
    max_views = max(0, max_views)
    
    # 날짜 필터
    cutoff_date = date.today() - timedelta(days=min_days)
    
    # Build query with filters (analyze_zombie_listings와 동일한 로직)
    query = db.query(Listing).filter(
        Listing.user_id == user_id
    )
    
    # Apply store filter if store_id is provided and not 'all'
    if store_id and store_id != 'all':
        if hasattr(Listing, 'store_id'):
            query = query.filter(Listing.store_id == store_id)
    
    # Date filter (analyze_zombie_listings와 동일한 로직)
    date_filters = []
    date_filters.append(
        and_(
            Listing.metrics.isnot(None),
            Listing.metrics.has_key('date_listed'),
            or_(
                and_(
                    func.jsonb_typeof(Listing.metrics['date_listed']) == 'string',
                    Listing.metrics['date_listed'].astext.isnot(None),
                    cast(Listing.metrics['date_listed'].astext, Date) < cutoff_date
                ),
                and_(
                    func.jsonb_typeof(Listing.metrics['date_listed']) == 'number',
                    Listing.metrics['date_listed'].astext.isnot(None),
                    cast(
                        func.to_timestamp(cast(Listing.metrics['date_listed'].astext, Integer)),
                        Date
                    ) < cutoff_date
                )
            )
        )
    )
    date_filters.append(
        and_(
            or_(
                Listing.metrics == None,
                ~Listing.metrics.has_key('date_listed')
            ),
            Listing.date_listed.isnot(None),
            Listing.date_listed < cutoff_date
        )
    )
    date_filters.append(
        and_(
            or_(
                Listing.metrics == None,
                ~Listing.metrics.has_key('date_listed')
            ),
            or_(
                Listing.date_listed == None,
                Listing.date_listed.is_(None)
            ),
            Listing.last_synced_at.isnot(None),
            func.date(Listing.last_synced_at) < cutoff_date
        )
    )
    
    if date_filters:
        query = query.filter(or_(*date_filters))
    
    # Sales filter
    if max_sales is not None and max_sales >= 0:
        sales_value = case(
            (
                and_(
                    Listing.metrics.isnot(None),
                    Listing.metrics.has_key('sales'),
                    func.jsonb_typeof(Listing.metrics['sales']).in_(['number', 'string']),
                    Listing.metrics['sales'].astext.isnot(None)
                ),
                cast(Listing.metrics['sales'].astext, Integer)
            ),
            else_=func.coalesce(
                func.coalesce(Listing.quantity_sold, 0),
                func.coalesce(Listing.sold_qty, 0),
                0
            )
        )
        query = query.filter(sales_value <= max_sales)
    
    # Watch filter
    if effective_max_watches is not None and effective_max_watches >= 0:
        watches_value = case(
            (
                and_(
                    Listing.metrics.isnot(None),
                    Listing.metrics.has_key('watches'),
                    func.jsonb_typeof(Listing.metrics['watches']) == 'object',
                    Listing.metrics['watches'].has_key('total_watches')
                ),
                cast(Listing.metrics['watches']['total_watches'].astext, Integer)
            ),
            (
                and_(
                    Listing.metrics.isnot(None),
                    Listing.metrics.has_key('watches'),
                    func.jsonb_typeof(Listing.metrics['watches']).in_(['number', 'string']),
                    Listing.metrics['watches'].astext.isnot(None)
                ),
                cast(Listing.metrics['watches'].astext, Integer)
            ),
            else_=func.coalesce(Listing.watch_count, 0)
        )
        query = query.filter(watches_value <= effective_max_watches)
    
    # Impressions filter
    if max_impressions is not None and max_impressions > 0:
        impressions_filter = or_(
            and_(
                Listing.metrics.isnot(None),
                Listing.metrics.has_key('impressions'),
                func.jsonb_typeof(Listing.metrics['impressions']) == 'object',
                Listing.metrics['impressions'].has_key('total_impressions'),
                cast(Listing.metrics['impressions']['total_impressions'].astext, Integer) < max_impressions
            ),
            and_(
                Listing.metrics.isnot(None),
                Listing.metrics.has_key('impressions'),
                func.jsonb_typeof(Listing.metrics['impressions']).in_(['number', 'string']),
                Listing.metrics['impressions'].astext.isnot(None),
                cast(Listing.metrics['impressions'].astext, Integer) < max_impressions
            ),
            or_(
                Listing.metrics == None,
                ~Listing.metrics.has_key('impressions')
            )
        )
        query = query.filter(impressions_filter)
    
    # Views filter
    if max_views is not None and max_views > 0:
        views_value = case(
            (
                and_(
                    Listing.metrics.isnot(None),
                    Listing.metrics.has_key('views'),
                    func.jsonb_typeof(Listing.metrics['views']) == 'object',
                    Listing.metrics['views'].has_key('total_views')
                ),
                cast(Listing.metrics['views']['total_views'].astext, Integer)
            ),
            (
                and_(
                    Listing.metrics.isnot(None),
                    Listing.metrics.has_key('views'),
                    func.jsonb_typeof(Listing.metrics['views']).in_(['number', 'string']),
                    Listing.metrics['views'].astext.isnot(None)
                ),
                cast(Listing.metrics['views'].astext, Integer)
            ),
            else_=0  # Fallback: no views data = 0 views
        )
        query = query.filter(views_value < max_views)
    
    # Apply platform filter
    if platform_filter and platform_filter in ["eBay", "Shopify"]:
        if hasattr(Listing, 'platform'):
            query = query.filter(Listing.platform == platform_filter)
        else:
            query = query.filter(Listing.marketplace == platform_filter)
    
    # Apply supplier filter if not "All"
    if supplier_filter and supplier_filter != "All":
        query = query.filter(Listing.supplier_name == supplier_filter)
    
    # Count only (don't fetch actual listings)
    count = query.count()
    return count


def upsert_listings(db: Session, listings: List[Listing], expected_user_id: Optional[str] = None) -> int:
    """
    UPSERT listings using PostgreSQL's ON CONFLICT DO UPDATE.
    
    This function handles duplicate key conflicts by updating existing records
    instead of raising IntegrityError. Uses the unique index 'idx_user_platform_item'
    which is on (user_id, platform, item_id).
    
    **공급처 자동 감지**: supplier_name과 supplier_id가 없으면 SKU, image_url, title, brand, upc를 기반으로 자동 감지합니다.
    
    For PostgreSQL: Uses INSERT ... ON CONFLICT DO UPDATE
    For SQLite: Falls back to individual INSERT OR REPLACE (less efficient but compatible)
    
    Args:
        db: Database session
        listings: List of Listing objects to upsert
        
    Returns:
        Number of listings processed
    """
    if not listings:
        return 0
    
    # ✅ 2단계: 저장 시 ID 강제 일치 - expected_user_id가 제공되면 모든 listing의 user_id를 강제로 설정
    if expected_user_id:
        logger.info("=" * 60)
        logger.info(f"🔒 [UPSERT] ID 강제 일치 모드 활성화")
        logger.info(f"   - Expected user_id: {expected_user_id}")
        logger.info(f"   - Total listings: {len(listings)}개")
        logger.info("=" * 60)
        
        for listing in listings:
            current_user_id = getattr(listing, 'user_id', None)
            if current_user_id != expected_user_id:
                logger.warning(f"⚠️ [UPSERT] user_id 불일치 감지: '{current_user_id}' -> '{expected_user_id}'로 강제 설정")
                listing.user_id = expected_user_id
            else:
                logger.debug(f"✅ [UPSERT] user_id 일치: {current_user_id}")
    
    # 공급처 자동 감지: supplier_name이 없거나 "Unverified"인 경우 자동 감지
    for listing in listings:
        if not listing.supplier_name or listing.supplier_name == "Unverified" or listing.supplier_name == "Unknown":
            # extract_supplier_info를 사용하여 공급처 자동 감지
            supplier_name, supplier_id = extract_supplier_info(
                sku=listing.sku or "",
                image_url=listing.image_url or "",
                title=listing.title or "",
                brand=listing.brand or "",
                upc=listing.upc or ""
            )
            listing.supplier_name = supplier_name
            listing.supplier_id = supplier_id
            # source 필드도 업데이트 (legacy 호환성)
            if hasattr(listing, 'source'):
                listing.source = supplier_name
    
    # Check if we're using PostgreSQL (has insert().on_conflict_do_update)
    # or SQLite (needs different approach)
    from sqlalchemy import inspect
    from .models import engine
    
    is_postgresql = engine.dialect.name == 'postgresql'
    
    if is_postgresql:
        # PostgreSQL: Use bulk INSERT ... ON CONFLICT DO UPDATE
        table = Listing.__table__
        
        # Prepare data dictionaries for bulk insert
        values_list = []
        for listing in listings:
            # ✅ 공급처 자동 감지: supplier_name이 없거나 "Unverified"/"Unknown"인 경우 자동 감지
            supplier_name = listing.supplier_name
            supplier_id = listing.supplier_id
            
            if not supplier_name or supplier_name in ["Unverified", "Unknown", ""]:
                # extract_supplier_info를 사용하여 공급처 자동 감지
                supplier_name, supplier_id = extract_supplier_info(
                    sku=listing.sku or "",
                    image_url=listing.image_url or "",
                    title=listing.title or "",
                    brand=listing.brand or "",
                    upc=listing.upc or ""
                )
                # Listing 객체도 업데이트 (나중에 사용할 수 있도록)
                listing.supplier_name = supplier_name
                listing.supplier_id = supplier_id
                # source 필드도 업데이트 (legacy 호환성)
                if hasattr(listing, 'source'):
                    listing.source = supplier_name
            
            # ✅ Shopify 경유 여부 자동 감지
            is_shopify = detect_shopify_routing(
                sku=listing.sku or "",
                image_url=listing.image_url or "",
                title=listing.title or "",
                brand=listing.brand or ""
            )
            
            # metrics와 analysis_meta에 management_hub 설정
            metrics = listing.metrics if listing.metrics else {}
            if not isinstance(metrics, dict):
                metrics = {}
            
            analysis_meta = listing.analysis_meta if listing.analysis_meta else {}
            if not isinstance(analysis_meta, dict):
                analysis_meta = {}
            
            if is_shopify:
                metrics["management_hub"] = "Shopify"
                analysis_meta["management_hub"] = "Shopify"
            
            # Convert Listing object to dictionary
            # ✅ CRITICAL: platform 필드를 반드시 "eBay"로 강제 설정
            # eBay sync에서는 항상 platform="eBay"로 저장되어야 함
            platform = "eBay"  # 항상 "eBay"로 강제 설정 (대소문자 정확히 일치)
            
            # ✅ FIX: item_id 필드가 없으면 ebay_item_id 사용
            item_id = getattr(listing, 'item_id', None) or getattr(listing, 'ebay_item_id', None) or ""
            
            # ✅ CRITICAL: user_id가 None이거나 빈 문자열이면 에러 발생 (fallback 금지)
            # expected_user_id가 제공되면 그것을 사용, 아니면 listing의 user_id 사용
            listing_user_id = expected_user_id if expected_user_id else getattr(listing, 'user_id', None)
            
            if not listing_user_id:
                logger.error(f"❌ [UPSERT] CRITICAL: user_id가 None입니다!")
                logger.error(f"   - listing.user_id: {listing_user_id}")
                logger.error(f"   - listing.id: {getattr(listing, 'id', 'N/A')}")
                logger.error(f"   - listing.title: {getattr(listing, 'title', 'N/A')[:50]}")
                raise ValueError(f"user_id가 유효하지 않습니다: {listing_user_id}. user_id는 필수입니다.")
            
            # ✅ FIX: Never access listing.raw_data - use empty dict directly to avoid AttributeError
            # SQLAlchemy objects may not have raw_data initialized, so always use empty dict
            values = {
                'user_id': listing_user_id,  # ✅ CRITICAL: expected_user_id 우선 사용
                'platform': platform,  # 정규화된 platform 값 사용
                'item_id': item_id,
                'title': listing.title,
                'image_url': listing.image_url,
                'sku': listing.sku,
                'supplier_name': supplier_name,  # 자동 감지된 값 사용
                'supplier_id': supplier_id,  # 자동 감지된 값 사용
                'brand': listing.brand,
                'upc': listing.upc,
                'metrics': metrics,  # Shopify 경유 정보 포함
                'raw_data': {},  # Always use empty dict - avoid AttributeError completely
                'analysis_meta': analysis_meta,  # Shopify 경유 정보 포함
                'last_synced_at': listing.last_synced_at if listing.last_synced_at else datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                # Legacy fields
                'price': listing.price,
                'date_listed': listing.date_listed,
                'sold_qty': listing.sold_qty if listing.sold_qty is not None else 0,
                'watch_count': listing.watch_count if listing.watch_count is not None else 0,
                'view_count': listing.view_count if hasattr(listing, 'view_count') and listing.view_count is not None else 0,
            }
            values_list.append(values)
        
        # ✅ BATCH PROCESSING: Process in chunks of 20 to prevent memory spikes and container crashes
        BATCH_SIZE = 20
        total_processed = 0
        failed_batches = 0
        
        logger.info(f"💾 [UPSERT] Processing {len(values_list)} listings in batches of {BATCH_SIZE}")
        
        for i in range(0, len(values_list), BATCH_SIZE):
            batch = values_list[i:i + BATCH_SIZE]
            batch_num = (i // BATCH_SIZE) + 1
            total_batches = (len(values_list) + BATCH_SIZE - 1) // BATCH_SIZE
            
            try:
                logger.info(f"💾 [UPSERT] Processing batch {batch_num}/{total_batches} ({len(batch)} items)")
                
                # Use PostgreSQL's INSERT ... ON CONFLICT DO UPDATE
                stmt = insert(table).values(batch)
                
                # On conflict, update these fields (but preserve created_at)
                # Use excluded table reference for PostgreSQL ON CONFLICT
                # ✅ FIX: platform 필드가 없으면 marketplace 사용, item_id가 없으면 ebay_item_id 사용
                conflict_columns = ['user_id']
                if hasattr(Listing, 'platform'):
                    conflict_columns.append('platform')
                elif hasattr(Listing, 'marketplace'):
                    conflict_columns.append('marketplace')
                if hasattr(Listing, 'item_id'):
                    conflict_columns.append('item_id')
                elif hasattr(Listing, 'ebay_item_id'):
                    conflict_columns.append('ebay_item_id')
                
                excluded = stmt.excluded
                stmt = stmt.on_conflict_do_update(
                    index_elements=conflict_columns,
                    set_={
                        'platform': 'eBay',  # ✅ CRITICAL: platform 필드를 항상 "eBay"로 강제 설정 (eBay sync 전용)
                        'title': excluded.title,
                        'image_url': excluded.image_url,
                        'sku': excluded.sku,
                        'supplier_name': excluded.supplier_name,
                        'supplier_id': excluded.supplier_id,
                        'brand': excluded.brand,
                        'upc': excluded.upc,
                        'metrics': excluded.metrics,  # Shopify 경유 정보 포함
                        'raw_data': excluded.raw_data,
                        'analysis_meta': excluded.analysis_meta,  # Shopify 경유 정보 포함
                        'last_synced_at': excluded.last_synced_at,
                        'updated_at': datetime.utcnow(),
                        # Legacy fields
                        'price': excluded.price,
                        'date_listed': excluded.date_listed,
                        'sold_qty': excluded.sold_qty,
                        'watch_count': excluded.watch_count,
                        'view_count': excluded.view_count if 'view_count' in [col.name for col in table.columns] else None,
                    }
                )
                
                # Execute batch
                result = db.execute(stmt)
                db.commit()
                total_processed += len(batch)
                logger.info(f"✅ [UPSERT] Batch {batch_num}/{total_batches} completed: {len(batch)} items saved")
                
            except Exception as batch_err:
                failed_batches += 1
                db.rollback()
                logger.error(f"❌ [UPSERT] Batch {batch_num}/{total_batches} failed: {str(batch_err)}")
                logger.error(f"   - Batch size: {len(batch)}")
                logger.error(f"   - Error type: {type(batch_err).__name__}")
                import traceback
                logger.error(f"   - Traceback: {traceback.format_exc()}")
                # Continue with next batch instead of failing completely
                # Try to save individual items from this batch
                logger.warning(f"⚠️ [UPSERT] Attempting to save batch {batch_num} items individually...")
                # Re-define conflict_columns for individual retry
                retry_conflict_columns = ['user_id']
                if hasattr(Listing, 'platform'):
                    retry_conflict_columns.append('platform')
                elif hasattr(Listing, 'marketplace'):
                    retry_conflict_columns.append('marketplace')
                if hasattr(Listing, 'item_id'):
                    retry_conflict_columns.append('item_id')
                elif hasattr(Listing, 'ebay_item_id'):
                    retry_conflict_columns.append('ebay_item_id')
                
                for item_idx, item in enumerate(batch):
                    try:
                        stmt_single = insert(table).values(item)
                        stmt_single = stmt_single.on_conflict_do_update(
                            index_elements=retry_conflict_columns,
                            set_=stmt_single.excluded
                        )
                        db.execute(stmt_single)
                        db.commit()
                        total_processed += 1
                    except Exception as item_err:
                        logger.error(f"❌ [UPSERT] Failed to save item {item_idx} in batch {batch_num}: {str(item_err)}")
                        db.rollback()
                        continue
                continue
        
        logger.info(f"✅ [UPSERT] Completed: {total_processed}/{len(values_list)} items processed successfully")
        
        # Return total processed count
        return total_processed
    else:
        # SQLite: Use individual INSERT OR REPLACE (less efficient but compatible)
        for listing in listings:
            # ✅ 공급처 자동 감지: supplier_name이 없거나 "Unverified"/"Unknown"인 경우 자동 감지
            supplier_name = listing.supplier_name
            supplier_id = listing.supplier_id
            
            if not supplier_name or supplier_name in ["Unverified", "Unknown", ""]:
                # extract_supplier_info를 사용하여 공급처 자동 감지
                supplier_name, supplier_id = extract_supplier_info(
                    sku=listing.sku or "",
                    image_url=listing.image_url or "",
                    title=listing.title or "",
                    brand=listing.brand or "",
                    upc=listing.upc or ""
                )
                # Listing 객체도 업데이트
                listing.supplier_name = supplier_name
                listing.supplier_id = supplier_id
                # source 필드도 업데이트 (legacy 호환성)
                if hasattr(listing, 'source'):
                    listing.source = supplier_name
            
            # ✅ Shopify 경유 여부 자동 감지
            is_shopify = detect_shopify_routing(
                sku=listing.sku or "",
                image_url=listing.image_url or "",
                title=listing.title or "",
                brand=listing.brand or ""
            )
            
            # metrics와 analysis_meta에 management_hub 설정
            if is_shopify:
                if not listing.metrics:
                    listing.metrics = {}
                if isinstance(listing.metrics, dict):
                    listing.metrics["management_hub"] = "Shopify"
                
                if not listing.analysis_meta:
                    listing.analysis_meta = {}
                if isinstance(listing.analysis_meta, dict):
                    listing.analysis_meta["management_hub"] = "Shopify"
            
            # ✅ FIX: platform 필드가 없으면 marketplace 사용, item_id가 없으면 ebay_item_id 사용
            platform = getattr(listing, 'platform', None) or getattr(listing, 'marketplace', None) or "eBay"
            item_id = getattr(listing, 'item_id', None) or getattr(listing, 'ebay_item_id', None) or ""
            
            # ✅ CRITICAL: user_id가 None이면 에러 발생 (fallback 금지)
            user_id = getattr(listing, 'user_id', None)
            if not user_id:
                logger.error(f"❌ [UPSERT SQLite] CRITICAL: user_id가 None입니다!")
                logger.error(f"   - listing.user_id: {user_id}")
                logger.error(f"   - listing.id: {getattr(listing, 'id', 'N/A')}")
                logger.error(f"   - listing.title: {getattr(listing, 'title', 'N/A')[:50]}")
                raise ValueError(f"user_id가 유효하지 않습니다: {user_id}. user_id는 필수입니다.")
            
            # Check if listing exists
            query = db.query(Listing).filter(Listing.user_id == user_id)
            if hasattr(Listing, 'platform'):
                query = query.filter(Listing.platform == platform)
            elif hasattr(Listing, 'marketplace'):
                query = query.filter(Listing.marketplace == platform)
            if hasattr(Listing, 'item_id'):
                query = query.filter(Listing.item_id == item_id)
            elif hasattr(Listing, 'ebay_item_id'):
                query = query.filter(Listing.ebay_item_id == item_id)
            
            existing = query.first()
            
            if existing:
                # Update existing record
                # ✅ CRITICAL: platform 필드도 업데이트 (eBay로 강제 설정)
                if hasattr(existing, 'platform'):
                    existing.platform = platform
                elif hasattr(existing, 'marketplace'):
                    existing.marketplace = platform
                existing.title = listing.title
                existing.image_url = listing.image_url
                existing.sku = listing.sku
                existing.supplier_name = supplier_name  # 자동 감지된 값 사용
                existing.supplier_id = supplier_id  # 자동 감지된 값 사용
                existing.brand = listing.brand
                existing.upc = listing.upc
                existing.metrics = listing.metrics if listing.metrics else {}  # Shopify 경유 정보 포함
                # ✅ FIX: Never access listing.raw_data - use empty dict directly to avoid AttributeError
                # SQLAlchemy objects may not have raw_data initialized, so always use empty dict
                existing.raw_data = {}
                existing.analysis_meta = listing.analysis_meta if listing.analysis_meta else {}  # Shopify 경유 정보 포함
                existing.last_synced_at = listing.last_synced_at if listing.last_synced_at else datetime.utcnow()
                existing.updated_at = datetime.utcnow()
                existing.price = listing.price
                existing.date_listed = listing.date_listed
                existing.sold_qty = listing.sold_qty if listing.sold_qty is not None else 0
                existing.watch_count = listing.watch_count if listing.watch_count is not None else 0
            else:
                # Insert new record
                listing.updated_at = datetime.utcnow()
                db.add(listing)
        
        db.commit()
    
    return len(listings)


def extract_csv_fields(listing: Listing) -> Dict[str, any]:
    """
    CSV 생성을 위한 필수 필드 추출
    - external_id (eBay ItemID)
    - sku
    - is_zombie
    - zombie_score
    - analysis_meta.recommendation.action
    """
    # external_id (eBay ItemID)
    external_id = (
        getattr(listing, 'item_id', None) or 
        getattr(listing, 'ebay_item_id', None) or 
        ""
    )
    
    # sku
    sku = getattr(listing, 'sku', '') or ""
    
    # is_zombie (metrics 또는 별도 필드에서)
    is_zombie = False
    if hasattr(listing, 'is_zombie'):
        is_zombie = bool(getattr(listing, 'is_zombie', False))
    elif hasattr(listing, 'metrics') and listing.metrics:
        if isinstance(listing.metrics, dict):
            is_zombie = listing.metrics.get('is_zombie', False)
    
    # zombie_score (metrics 또는 별도 필드에서)
    zombie_score = None
    if hasattr(listing, 'zombie_score'):
        zombie_score = getattr(listing, 'zombie_score', None)
    elif hasattr(listing, 'metrics') and listing.metrics:
        if isinstance(listing.metrics, dict):
            zombie_score = listing.metrics.get('zombie_score', None)
    
    # analysis_meta.recommendation.action
    # ✅ FIX: JSONB 필드 안전하게 추출 (문자열 파싱 지원)
    action = None
    try:
        if hasattr(listing, 'analysis_meta') and listing.analysis_meta:
            analysis_meta = listing.analysis_meta
            # JSONB가 문자열로 저장된 경우 파싱
            if isinstance(analysis_meta, str):
                try:
                    analysis_meta = json.loads(analysis_meta)
                except (json.JSONDecodeError, TypeError):
                    analysis_meta = None
            
            if isinstance(analysis_meta, dict):
                recommendation = analysis_meta.get('recommendation', {})
                if isinstance(recommendation, dict):
                    action = recommendation.get('action', None)
        elif hasattr(listing, 'metrics') and listing.metrics:
            metrics = listing.metrics
            # JSONB가 문자열로 저장된 경우 파싱
            if isinstance(metrics, str):
                try:
                    metrics = json.loads(metrics)
                except (json.JSONDecodeError, TypeError):
                    metrics = None
            
            if isinstance(metrics, dict):
                analysis_meta = metrics.get('analysis_meta', {})
                if isinstance(analysis_meta, str):
                    try:
                        analysis_meta = json.loads(analysis_meta)
                    except (json.JSONDecodeError, TypeError):
                        analysis_meta = None
                
                if isinstance(analysis_meta, dict):
                    recommendation = analysis_meta.get('recommendation', {})
                    if isinstance(recommendation, dict):
                        action = recommendation.get('action', None)
    except Exception as e:
        # 안정성: 예외 발생 시 None 반환 (500 에러 방지)
        print(f"Warning: Failed to extract action from analysis_meta: {e}")
        action = None
    
    return {
        'external_id': external_id,
        'sku': sku,
        'is_zombie': is_zombie,
        'zombie_score': zombie_score,
        'action': action
    }


def export_zombies_to_csv(zombie_listings: List[Listing]) -> str:
    """
    Standard CSV Export Format for Zombie Listings
    
    Generates a standardized CSV file with the following columns (in exact order):
    - item_id: The eBay Listing ID for deletion
    - supplier_id: Supplier ID for user tracking/reference
    - supplier_name: Supplier name (e.g., 'AMAZON', 'WALMART')
    - reason: Static field (e.g., 'Low Interest/Zombie Item')
    - listing_url: The live eBay listing URL (generated from item_id or extracted from raw_data)
    
    Args:
        zombie_listings: List of Listing objects to export
        
    Returns:
        CSV string with standard format
    """
    if not zombie_listings:
        return ""
    
    data = []
    for listing in zombie_listings:
        # Extract item_id
        item_id = listing.item_id if hasattr(listing, 'item_id') else ""
        
        # Extract supplier_id (fallback to empty string if None)
        supplier_id = listing.supplier_id if hasattr(listing, 'supplier_id') and listing.supplier_id else ""
        
        # Extract supplier_name (uppercase for consistency)
        supplier_name = (listing.supplier_name if hasattr(listing, 'supplier_name') else "Unknown").upper()
        
        # Generate listing_url: Try to extract from raw_data first, otherwise generate eBay URL
        listing_url = ""
        if item_id:
            # Try to get URL from raw_data if available
            if hasattr(listing, 'raw_data') and listing.raw_data:
                raw_data = listing.raw_data
                if isinstance(raw_data, dict):
                    listing_url = raw_data.get('listing_url') or raw_data.get('url') or raw_data.get('viewItemURL') or ""
                elif isinstance(raw_data, str):
                    try:
                        parsed_data = json.loads(raw_data)
                        listing_url = parsed_data.get('listing_url') or parsed_data.get('url') or parsed_data.get('viewItemURL') or ""
                    except:
                        pass
            
            # If no URL found in raw_data, generate eBay URL
            if not listing_url:
                # Format: https://www.ebay.com/itm/{item_id}
                listing_url = f"https://www.ebay.com/itm/{item_id}"
        
        # Static reason field
        reason = "Low Interest/Zombie Item"
        
        # Append row with columns in exact order: item_id, supplier_id, supplier_name, reason, listing_url
        data.append({
            "item_id": item_id,
            "supplier_id": supplier_id,
            "supplier_name": supplier_name,
            "reason": reason,
            "listing_url": listing_url
        })
    
    # Convert to CSV using pandas (columns will be in the order they were added to dict)
    df = pd.DataFrame(data)
    output = StringIO()
    df.to_csv(output, index=False)
    return output.getvalue()


def get_csv_format(db: Session, supplier_name: str) -> Optional[dict]:
    """
    DB에서 CSV 포맷 가져오기
    
    Args:
        db: Database session
        supplier_name: 공급처/도구 이름 (e.g., "autods", "wholesale2b")
    
    Returns:
        CSV 포맷 스키마 또는 None
    """
    from models import CSVFormat
    
    csv_format = db.query(CSVFormat).filter(
        CSVFormat.supplier_name == supplier_name,
        CSVFormat.is_active == True
    ).first()
    
    if csv_format:
        return csv_format.format_schema
    return None


def generate_export_csv(
    listings,
    target_tool: str,
    db: Optional[Session] = None,
    user_id: str = None,  # user_id는 필수 파라미터 - None이면 에러 발생
    mode: str = "delete_list",
    store_id: Optional[str] = None,
    platform: Optional[str] = None
) -> str:
    """
    CSV Export for Dropshipping Automation Tools Only
    
    CSV 포맷은 DB에서 가져와서 사용합니다.
    각 공급처별 공식 포맷에 맞춰 데이터를 매핑합니다.
    
    Supported export formats (DB에서 관리):
    1. AutoDS: Headers: "Source ID", "File Action" | Data: supplier_id, "delete"
    2. Wholesale2B: Headers: "SKU", "Action" | Data: sku, "Delete"
    3. Shopify (Matrixify/Excelify): Headers: "ID", "Command" | Data: item_id, "DELETE"
    4. Shopify (Tagging Method): Headers: "Handle", "Tags" | Data: handle/sku, "OptListing_Delete"
    5. eBay File Exchange: Headers: "Action", "ItemID" | Data: "End", item_id
    6. Yaballe: Headers: "Monitor ID", "Action" | Data: supplier_id, "DELETE"
    7. BigCommerce: Headers: "Product ID", "Action" | Data: item_id/sku, "DELETE"
    
    Args:
        listings: List of Listing objects or dictionaries (items to delete OR items to exclude in full_sync mode)
        target_tool: Tool name (e.g., "autods", "wholesale2b", "shopify_matrixify", "shopify_tagging", "ebay", "yaballe", "bigcommerce")
        db: Optional database session for logging deletions with snapshots and fetching all listings
        user_id: User ID for deletion logging and fetching listings
        mode: Export mode - "delete_list" (default) exports items to delete, "full_sync_list" exports survivors (all items except provided list)
        store_id: Optional store ID filter for full_sync_list mode
        platform: Optional platform parameter - if provided, overrides target_tool mapping ("shopify" -> "shopify_matrixify", "bigcommerce" -> "bigcommerce")
    
    Returns:
        CSV string in tool-specific format
    
    Note: Assumes 100% of items are from supported Dropshipping Tools (no manual/direct listings).
    """
    # Platform-based target_tool mapping (if platform is provided)
    # platform 파라미터가 제공되면 target_tool을 플랫폼에 맞게 매핑
    if platform:
        platform_to_tool = {
            'shopify': 'shopify_matrixify',
            'bigcommerce': 'bigcommerce'
        }
        # Override target_tool if platform is recognized
        if platform.lower() in platform_to_tool:
            target_tool = platform_to_tool[platform.lower()]
            logger.info(f"🔄 Platform '{platform}' mapped to target_tool '{target_tool}'")
    # Full Sync Mode: Export all active listings EXCEPT the provided list
    if mode == "full_sync_list" and db:
        # Get all active listings for this user/store
        query = db.query(Listing).filter(Listing.user_id == user_id)
        
        # Apply store filter if provided and not 'all'
        if store_id and store_id != 'all':
            if hasattr(Listing, 'store_id'):
                query = query.filter(Listing.store_id == store_id)
        
        all_listings = query.all()
        
        # Extract item IDs from the exclusion list (zombies to remove)
        exclusion_item_ids = set()
        for listing in listings:
            if isinstance(listing, dict):
                item_id = listing.get("item_id") or listing.get("ebay_item_id", "")
            else:
                item_id = listing.item_id if hasattr(listing, 'item_id') else (listing.ebay_item_id if hasattr(listing, 'ebay_item_id') else "")
            if item_id:
                exclusion_item_ids.add(item_id)
        
        # Filter out excluded items (survivors only)
        survivor_listings = [
            listing for listing in all_listings
            if listing.item_id not in exclusion_item_ids
        ]
        
        # Use survivors as the export list (no deletion logging for full sync mode)
        listings = survivor_listings
    elif not listings:
        return ""
    
    # Validate user_id (필수 파라미터)
    if not user_id:
        raise ValueError("user_id is required for CSV export. Cannot export without a valid user_id.")
    
    # Log deletions with snapshots BEFORE generating CSV (only for delete_list mode)
    if db and mode == "delete_list":
        deletion_logs = []
        for listing in listings:
            # Extract data for snapshot
            if isinstance(listing, dict):
                item_id = listing.get("item_id") or listing.get("ebay_item_id", "")
                title = listing.get("title", "Unknown")
                platform = listing.get("platform") or listing.get("marketplace", "eBay")
                supplier = listing.get("supplier") or listing.get("supplier_name") or listing.get("source", "Unknown")
                price = listing.get("price") or (listing.get("metrics", {}).get("price") if isinstance(listing.get("metrics"), dict) else None)
                views = listing.get("watch_count") or listing.get("views") or (listing.get("metrics", {}).get("views") if isinstance(listing.get("metrics"), dict) else None)
                sales = listing.get("sold_qty") or listing.get("sales") or (listing.get("metrics", {}).get("sales") if isinstance(listing.get("metrics"), dict) else None)
                metrics = listing.get("metrics", {}) if isinstance(listing.get("metrics"), dict) else {}
            else:
                item_id = listing.item_id if hasattr(listing, 'item_id') else (listing.ebay_item_id if hasattr(listing, 'ebay_item_id') else "")
                title = listing.title if hasattr(listing, 'title') else "Unknown"
                platform = listing.platform if hasattr(listing, 'platform') else (listing.marketplace if hasattr(listing, 'marketplace') else "eBay")
                supplier = listing.supplier_name if hasattr(listing, 'supplier_name') else "Unknown"
                price = getattr(listing, 'price', None) or (listing.metrics.get('price') if listing.metrics and isinstance(listing.metrics, dict) else None)
                views = getattr(listing, 'watch_count', None) or (listing.metrics.get('views') if listing.metrics and isinstance(listing.metrics, dict) else None)
                sales = getattr(listing, 'sold_qty', None) or (listing.metrics.get('sales') if listing.metrics and isinstance(listing.metrics, dict) else None)
                metrics = listing.metrics if listing.metrics and isinstance(listing.metrics, dict) else {}
            
            # Create snapshot with current item state
            snapshot = {
                "price": price,
                "views": views,
                "sales": sales,
                "title": title,
                "supplier": supplier,
                "platform": platform,
                "metrics": metrics
            }
            
            # Create DeletionLog entry with snapshot
            log_entry = DeletionLog(
                item_id=item_id,
                title=title,
                platform=platform,
                supplier=supplier,
                snapshot=snapshot
            )
            deletion_logs.append(log_entry)
        
        # Bulk insert deletion logs
        if deletion_logs:
            db.add_all(deletion_logs)
            db.commit()
    
    # Get CSV format from database
    if not db:
        raise ValueError("Database session is required to fetch CSV format")
    
    format_schema = get_csv_format(db, target_tool)
    if not format_schema:
        raise ValueError(f"CSV format not found for target tool: {target_tool}. Please ensure the format is initialized in the database.")
    
    columns = format_schema.get("column_order", format_schema.get("columns", []))
    mappings = format_schema.get("mappings", {})
    
    data = []
    
    for listing in listings:
        # Handle both Listing objects and dictionaries
        if isinstance(listing, dict):
            item_id = listing.get("item_id") or listing.get("ebay_item_id") or ""
            sku = listing.get("sku") or ""
            # supplier_id: 기본값 빈 문자열로 안전하게 처리
            supplier_id = listing.get("supplier_id") or ""
            supplier_name = listing.get("supplier_name") or listing.get("supplier") or listing.get("source") or "Unknown"
            platform = listing.get("platform") or listing.get("marketplace") or ""
            # Try to get handle from raw_data or use SKU as fallback
            raw_data = listing.get("raw_data", {})
            if isinstance(raw_data, str):
                try:
                    raw_data = json.loads(raw_data)
                except:
                    raw_data = {}
            handle = (raw_data.get("handle") if raw_data else None) or sku
        else:
            item_id = (listing.item_id if hasattr(listing, 'item_id') and listing.item_id else None) or (listing.ebay_item_id if hasattr(listing, 'ebay_item_id') and listing.ebay_item_id else None) or ""
            sku = listing.sku if hasattr(listing, 'sku') and listing.sku else ""
            # supplier_id: 기본값 None 또는 빈 문자열로 안전하게 처리
            supplier_id = (listing.supplier_id if hasattr(listing, 'supplier_id') and listing.supplier_id else None) or ""
            supplier_name = (listing.supplier_name if hasattr(listing, 'supplier_name') and listing.supplier_name else None) or (listing.supplier if hasattr(listing, 'supplier') and listing.supplier else None) or (listing.source if hasattr(listing, 'source') and listing.source else None) or "Unknown"
            platform = (listing.platform if hasattr(listing, 'platform') and listing.platform else None) or (listing.marketplace if hasattr(listing, 'marketplace') and listing.marketplace else None) or ""
            # Try to get handle from raw_data
            raw_data = listing.raw_data if hasattr(listing, 'raw_data') and listing.raw_data else {}
            if isinstance(raw_data, str):
                try:
                    raw_data = json.loads(raw_data)
                except:
                    raw_data = {}
            handle = (raw_data.get("handle") if raw_data and isinstance(raw_data, dict) else None) or sku
        
        # Build row data based on format schema mappings
        row = {}
        for column_name in columns:
            mapping = mappings.get(column_name, {})
            
            # Check if it's a static value
            if "value" in mapping:
                row[column_name] = mapping["value"]
            # Otherwise, get value from listing data
            elif "source" in mapping:
                source_field = mapping["source"]
                value = None
                
                # Get value from listing data (안전하게 처리)
                if source_field == "item_id":
                    value = item_id if item_id else ""
                elif source_field == "sku":
                    value = sku if sku else ""
                elif source_field == "supplier_id":
                    value = supplier_id if supplier_id else ""
                elif source_field == "handle":
                    value = handle if handle else ""
                else:
                    value = ""
                
                # Use fallback if value is empty and fallback is specified
                if not value and "fallback" in mapping:
                    fallback_field = mapping["fallback"]
                    if fallback_field == "sku":
                        value = sku if sku else ""
                    elif fallback_field == "supplier_id":
                        value = supplier_id if supplier_id else ""
                    elif fallback_field == "item_id":
                        value = item_id if item_id else ""
                    else:
                        value = ""
                
                # 최종적으로 빈 문자열 보장
                row[column_name] = value if value else ""
            else:
                row[column_name] = ""
        
        data.append(row)
    
    df = pd.DataFrame(data)
    
    # Ensure columns are in the correct order
    if columns:
        df = df[columns]
    
    # Convert to CSV string
    output = StringIO()
    df.to_csv(output, index=False)
    return output.getvalue()

