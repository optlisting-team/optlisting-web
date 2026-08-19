# 공급처 감지 시스템 개선 제안

## 🔍 현재 감지 시스템 분석

### ✅ 잘 작동하는 부분
1. **SKU 패턴 매칭**: 접두사 기반 감지 (AMZ, WM, AE 등)
2. **기본 Image URL 패턴**: alicdn, walmart 등
3. **Shopify 경유 감지**: 별도 함수로 분리

### ⚠️ 개선이 필요한 부분

#### 1. Image URL 패턴 부족
**현재 문제:**
- Amazon: `ssl-images-amazon.com`만 확인
- Walmart: `walmart`만 확인
- 실제로는 더 많은 도메인 패턴이 있음

**실제 패턴 예시:**
- Amazon: `images-na.ssl-images-amazon.com`, `m.media-amazon.com`, `images.amazon.com`
- Walmart: `i5.walmartimages.com`, `i.walmartimages.com`
- AliExpress: `ae01.alicdn.com`, `ae02.alicdn.com` 등

#### 2. Title/Brand에서 공급처 키워드 검색 부족
**현재 문제:**
- SKU와 Image URL만 확인
- Title에 "Amazon", "Walmart" 등이 포함되어 있어도 감지 안 됨

**예시:**
- Title: "Amazon Basics USB Cable"
- Title: "Walmart Mainstays Desk Lamp"

#### 3. AutoDS SKU 패턴
**현재 문제:**
- AutoDS 사용자들은 보통 ASIN을 그대로 사용
- "AMZ-" 접두사가 없을 수도 있음
- Image URL이 더 신뢰할 수 있는 단서

#### 4. 공급처 우선순위
**현재 문제:**
- SKU 패턴만 확인하고 Image URL은 보조로만 사용
- Image URL이 더 정확할 수 있음

---

## 💡 개선 제안

### 1. Image URL 패턴 강화
```python
# Amazon Image URL 패턴
amazon_url_patterns = [
    "ssl-images-amazon.com",
    "images-na.ssl-images-amazon.com",
    "m.media-amazon.com",
    "images.amazon.com",
    "amazon-adsystem.com"
]

# Walmart Image URL 패턴
walmart_url_patterns = [
    "walmartimages.com",
    "i5.walmartimages.com",
    "i.walmartimages.com",
    "walmart.com/images"
]

# AliExpress Image URL 패턴
aliexpress_url_patterns = [
    "alicdn.com",
    "ae01.alicdn.com",
    "ae02.alicdn.com",
    "ae03.alicdn.com"
]
```

### 2. Title/Brand 키워드 검색 추가
```python
# Title에서 공급처 키워드 검색
if "amazon" in title_lower and "basics" in title_lower:
    return ("Amazon", None)

if "walmart" in title_lower or "mainstays" in title_lower:
    return ("Walmart", None)
```

### 3. 감지 우선순위 개선
1. **SKU 패턴** (HIGH confidence)
2. **Image URL 패턴** (HIGH confidence) - 현재보다 더 강화
3. **Title/Brand 키워드** (MEDIUM confidence)
4. **UPC/EAN 패턴** (HIGH confidence) - 향후 추가

### 4. AutoDS 특별 처리
- ASIN 패턴 (B0...)이 있으면 Amazon으로 감지
- Image URL이 Amazon이면 Amazon으로 감지
- SKU에 "AMZ"가 없어도 Image URL로 감지 가능

---

## 🎯 권장 개선 사항

### 즉시 개선 (높은 우선순위)
1. ✅ Image URL 패턴 확장 (Amazon, Walmart, AliExpress)
2. ✅ Title에서 공급처 키워드 검색 추가
3. ✅ 감지 우선순위 조정 (Image URL도 HIGH confidence로)

### 향후 개선 (중간 우선순위)
4. UPC/EAN 패턴 기반 감지
5. Brand 필드 활용 강화
6. Confidence 점수 시스템 도입

---

## 📊 예상 감지 정확도

### 현재 예상 정확도
- **SKU 패턴이 있는 경우**: ~90%
- **SKU 패턴이 없는 경우**: ~30-40% (Image URL만으로)

### 개선 후 예상 정확도
- **SKU 패턴이 있는 경우**: ~95%
- **SKU 패턴이 없는 경우**: ~70-80% (Image URL + Title)

---

## ⚠️ 주의사항

1. **False Positive 방지**
   - Title에 "Amazon"이 포함되어 있어도 실제로는 다른 공급처일 수 있음
   - 예: "Amazon-like product" (실제로는 AliExpress)
   - 따라서 Title 검색은 보조 수단으로만 사용

2. **우선순위 중요**
   - SKU 패턴 > Image URL > Title 순서로 확인
   - 여러 단서가 일치할 때만 HIGH confidence

3. **Unverified 처리**
   - 감지 실패 시 "Unverified"로 표시
   - 사용자가 수동으로 수정 가능

