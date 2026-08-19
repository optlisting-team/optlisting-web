import os
from sqlalchemy import create_engine, text

url = os.getenv('DATABASE_URL')
if url:
    try:
        engine = create_engine(url)
        with engine.begin() as conn:
            conn.execute(text('ALTER TABLE deletion_logs ADD COLUMN IF NOT EXISTS sku TEXT;'))
        print('SUCCESS: Column added.')
    except Exception as e:
        print('FAILED:', e)
else:
    print('FAILED: DATABASE_URL is not set in Railway environment.')
