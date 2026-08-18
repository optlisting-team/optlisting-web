"""
Database migration script. Runs SQL directly against Supabase PostgreSQL.
"""
import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if not DATABASE_URL:
    print("❌ DATABASE_URL env var not set.")
    sys.exit(1)

# Remove quotes if present
DATABASE_URL = DATABASE_URL.strip('"').strip("'").lstrip('=')

print(f"🔗 Connecting to database...")
print(f"   Host: {DATABASE_URL.split('@')[1].split('/')[0] if '@' in DATABASE_URL else 'N/A'}")

try:
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # Run SQL queries
    sql_queries = [
        "-- 1. Truncate listings table",
        "TRUNCATE TABLE listings CASCADE;",
        
        "-- 2. Drop existing UNIQUE on ebay_item_id if present",
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
                RAISE NOTICE 'Dropped existing ebay_item_id UNIQUE constraint';
            END IF;
        END $$;
        """,
        
        "-- 3. Add UNIQUE on (ebay_item_id, user_id)",
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_ebay_item_id_user_id 
        ON listings(ebay_item_id, user_id);
        """,
    ]
    
    with engine.connect() as conn:
        # Begin transaction
        trans = conn.begin()
        
        try:
            # Count before
            result = conn.execute(text("SELECT COUNT(*) FROM listings"))
            before_count = result.scalar()
            print(f"📊 Listings count before: {before_count}")
            
            # Execute SQL
            for query in sql_queries:
                if query.strip().startswith('--'):
                    print(f"\n{query}")
                    continue
                print(f"   Running: {query[:50]}...")
                conn.execute(text(query))
            
            trans.commit()
            
            # Count after
            result = conn.execute(text("SELECT COUNT(*) FROM listings"))
            after_count = result.scalar()
            
            # Verify constraint
            result = conn.execute(text("""
                SELECT indexname 
                FROM pg_indexes 
                WHERE tablename = 'listings' 
                AND indexname = 'idx_listings_ebay_item_id_user_id'
            """))
            index_exists = result.fetchone() is not None
            
            print("\n" + "="*60)
            print("✅ Migration complete!")
            print(f"   - Data before: {before_count}")
            print(f"   - Data after: {after_count}")
            print(f"   - UNIQUE constraint added: {'✅' if index_exists else '❌'}")
            print("="*60)
            
        except Exception as e:
            trans.rollback()
            print(f"\nError: {e}")
            raise
    
    engine.dispose()
    
except Exception as e:
    print(f"\nDatabase connection failed: {e}")
    sys.exit(1)




