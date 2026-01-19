"""
데이터베이스 마이그레이션 실행 스크립트
Supabase PostgreSQL에 직접 SQL을 실행합니다.
"""
import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if not DATABASE_URL:
    print("❌ DATABASE_URL 환경 변수가 설정되지 않았습니다.")
    sys.exit(1)

# Remove quotes if present
DATABASE_URL = DATABASE_URL.strip('"').strip("'").lstrip('=')

print(f"🔗 데이터베이스 연결 중...")
print(f"   Host: {DATABASE_URL.split('@')[1].split('/')[0] if '@' in DATABASE_URL else 'N/A'}")

try:
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # SQL 쿼리 실행
    sql_queries = [
        "-- 1. listings 테이블의 모든 데이터 삭제",
        "TRUNCATE TABLE listings CASCADE;",
        
        "-- 2. 기존 UNIQUE 제약 조건 확인 및 제거",
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conrelid = 'listings'::regclass 
                AND conname = 'listings_ebay_item_id_key'
                AND contype = 'u'
            ) THEN
                ALTER TABLE listings DROP CONSTRAINT listings_ebay_item_id_key;
                RAISE NOTICE '✅ 기존 ebay_item_id UNIQUE 제약 조건 제거됨';
            END IF;
        END $$;
        """,
        
        "-- 3. ebay_item_id와 user_id 조합에 대한 UNIQUE 제약 조건 추가",
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_ebay_item_id_user_id 
        ON listings(ebay_item_id, user_id);
        """,
    ]
    
    with engine.connect() as conn:
        # 트랜잭션 시작
        trans = conn.begin()
        
        try:
            # 삭제 전 데이터 개수 확인
            result = conn.execute(text("SELECT COUNT(*) FROM listings"))
            before_count = result.scalar()
            print(f"📊 삭제 전 listings 개수: {before_count}개")
            
            # SQL 쿼리 실행
            for query in sql_queries:
                if query.strip().startswith('--'):
                    print(f"\n{query}")
                    continue
                print(f"   실행 중: {query[:50]}...")
                conn.execute(text(query))
            
            # 트랜잭션 커밋
            trans.commit()
            
            # 삭제 후 데이터 개수 확인
            result = conn.execute(text("SELECT COUNT(*) FROM listings"))
            after_count = result.scalar()
            
            # 제약 조건 확인
            result = conn.execute(text("""
                SELECT indexname 
                FROM pg_indexes 
                WHERE tablename = 'listings' 
                AND indexname = 'idx_listings_ebay_item_id_user_id'
            """))
            index_exists = result.fetchone() is not None
            
            print("\n" + "="*60)
            print("✅ 마이그레이션 완료!")
            print(f"   - 삭제된 데이터: {before_count}개")
            print(f"   - 현재 데이터: {after_count}개")
            print(f"   - UNIQUE 제약 조건 추가: {'✅' if index_exists else '❌'}")
            print("="*60)
            
        except Exception as e:
            trans.rollback()
            print(f"\n❌ 오류 발생: {e}")
            raise
    
    engine.dispose()
    
except Exception as e:
    print(f"\n❌ 데이터베이스 연결 실패: {e}")
    sys.exit(1)




