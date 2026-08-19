# CSV 벌크 삭제 지원 공급처 조사 목록

## ✅ 현재 지원 중인 도구 (6개)

1. **AutoDS** - `autods`
   - 포맷: `Source ID`, `File Action`
   - 상태: ✅ 구현 완료

2. **Wholesale2B** - `wholesale2b`
   - 포맷: `SKU`, `Action`
   - 상태: ✅ 구현 완료

3. **Shopify Matrixify/Excelify** - `shopify_matrixify`
   - 포맷: `ID`, `Command`
   - 상태: ✅ 구현 완료

4. **Shopify Tagging Method** - `shopify_tagging`
   - 포맷: `Handle`, `Tags`
   - 상태: ✅ 구현 완료

5. **eBay File Exchange** - `ebay`
   - 포맷: `Action`, `ItemID`
   - 상태: ✅ 구현 완료

6. **Yaballe** - `yaballe`
   - 포맷: `Monitor ID`, `Action`
   - 상태: ✅ 구현 완료

---

## 🔍 조사 필요 공급처/도구

### 주요 드랍쉬핑 자동화 도구

1. **CJ Dropshipping**
   - 공급처로는 지원하지만 CSV 벌크 삭제 포맷 미확인
   - 조사 필요: CSV import 기능, 벌크 삭제 지원 여부

2. **Spocket**
   - 공급처로는 지원하지만 CSV 벌크 삭제 포맷 미확인
   - 조사 필요: CSV import 기능, 벌크 삭제 지원 여부

3. **Zendrop**
   - 공급처로는 지원하지만 CSV 벌크 삭제 포맷 미확인
   - 조사 필요: CSV import 기능, 벌크 삭제 지원 여부

4. **AliExpress Dropshipping Center**
   - AliExpress 관련 도구들의 CSV 포맷 조사 필요
   - 조사 필요: 공식 CSV import 포맷

5. **SaleHoo**
   - 공급처로는 지원하지만 CSV 벌크 삭제 포맷 미확인
   - 조사 필요: CSV import 기능, 벌크 삭제 지원 여부

6. **Inventory Source**
   - 공급처로는 지원하지만 CSV 벌크 삭제 포맷 미확인
   - 조사 필요: CSV import 기능, 벌크 삭제 지원 여부

7. **Dropified**
   - 공급처로는 지원하지만 CSV 벌크 삭제 포맷 미확인
   - 조사 필요: CSV import 기능, 벌크 삭제 지원 여부

### 기타 주요 마켓플레이스/도구

8. **Amazon Seller Central**
   - Amazon 직접 판매자용 CSV 포맷 조사 필요
   - 조사 필요: Inventory 파일 포맷, 벌크 삭제 지원 여부

9. **Walmart Marketplace**
   - Walmart 직접 판매자용 CSV 포맷 조사 필요
   - 조사 필요: Inventory 파일 포맷, 벌크 삭제 지원 여부

10. **Etsy**
    - Etsy 판매자용 CSV 포맷 조사 필요
    - 조사 필요: Listing import/export 포맷

11. **WooCommerce**
    - WooCommerce CSV import 포맷 조사 필요
    - 조사 필요: Product import 포맷, 벌크 삭제 지원 여부

12. **BigCommerce**
    - BigCommerce CSV import 포맷 조사 필요
    - 조사 필요: Product import 포맷, 벌크 삭제 지원 여부

13. **PrestaShop**
    - PrestaShop CSV import 포맷 조사 필요
    - 조사 필요: Product import 포맷

14. **Magento**
    - Magento CSV import 포맷 조사 필요
    - 조사 필요: Product import 포맷, 벌크 삭제 지원 여부

---

## 📋 조사 시 확인할 정보

각 공급처/도구에 대해 다음 정보를 확인해야 합니다:

1. **CSV 벌크 삭제 지원 여부**
   - CSV 파일을 통한 대량 삭제 기능이 있는지

2. **공식 CSV 포맷**
   - 정확한 컬럼명 (대소문자, 공백 포함)
   - 컬럼 순서
   - 필수 컬럼 vs 선택 컬럼

3. **데이터 매핑 규칙**
   - 어떤 필드가 삭제 대상 식별자로 사용되는지 (SKU, Product ID, Item ID 등)
   - 삭제 액션을 나타내는 값 (예: "delete", "DELETE", "Remove", "End" 등)

4. **참고 자료**
   - 공식 문서 링크
   - 지원 센터 링크
   - 예시 CSV 파일

---

## 🎯 우선순위

### 높은 우선순위 (많이 사용되는 도구)
1. CJ Dropshipping
2. Spocket
3. Zendrop
4. AliExpress Dropshipping Center

### 중간 우선순위
5. SaleHoo
6. Inventory Source
7. Dropified

### 낮은 우선순위 (직접 마켓플레이스)
8. Amazon Seller Central
9. Walmart Marketplace
10. Etsy
11. WooCommerce
12. BigCommerce

---

## 📝 조사 결과 추가 방법

조사 결과를 받으면 `backend/init_csv_formats.py` 파일에 다음 형식으로 추가:

```python
{
    "supplier_name": "공급처_이름",
    "display_name": "표시용 이름",
    "description": "설명",
    "format_schema": {
        "columns": ["컬럼1", "컬럼2"],
        "column_order": ["컬럼1", "컬럼2"],
        "mappings": {
            "컬럼1": {
                "source": "데이터_소스",  # "item_id", "sku", "supplier_id", "handle"
                "fallback": "대체_소스",  # 선택사항
                "type": "string"
            },
            "컬럼2": {
                "value": "고정값",  # 예: "delete", "DELETE"
                "type": "string"
            }
        }
    }
}
```

