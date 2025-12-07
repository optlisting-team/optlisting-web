-- CSV 포맷 테이블 생성
CREATE TABLE IF NOT EXISTS csv_formats (
    id SERIAL PRIMARY KEY,
    supplier_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    format_schema JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_supplier_name UNIQUE (supplier_name)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_csv_formats_supplier_name ON csv_formats(supplier_name);
CREATE INDEX IF NOT EXISTS idx_csv_formats_is_active ON csv_formats(is_active);

-- 업데이트 시간 자동 갱신 트리거 (PostgreSQL)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_csv_formats_updated_at 
    BEFORE UPDATE ON csv_formats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

