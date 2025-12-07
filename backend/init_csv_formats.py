"""
CSV 포맷 초기 데이터 생성 스크립트
각 공급처별 공식 CSV 포맷을 DB에 저장
"""
import json
from sqlalchemy.orm import Session
from models import CSVFormat, Base, engine, SessionLocal


def init_csv_formats(db: Session):
    """CSV 포맷 초기 데이터 생성"""
    
    formats = [
        {
            "supplier_name": "autods",
            "display_name": "AutoDS",
            "description": "AutoDS CSV import format for bulk deletion",
            "format_schema": {
                "columns": ["Source ID", "File Action"],
                "column_order": ["Source ID", "File Action"],
                "mappings": {
                    "Source ID": {
                        "source": "supplier_id",
                        "fallback": "sku",
                        "type": "string"
                    },
                    "File Action": {
                        "value": "delete",
                        "type": "string"
                    }
                }
            }
        },
        {
            "supplier_name": "wholesale2b",
            "display_name": "Wholesale2B",
            "description": "Wholesale2B CSV import format for bulk deletion",
            "format_schema": {
                "columns": ["SKU", "Action"],
                "column_order": ["SKU", "Action"],
                "mappings": {
                    "SKU": {
                        "source": "sku",
                        "type": "string"
                    },
                    "Action": {
                        "value": "Delete",
                        "type": "string"
                    }
                }
            }
        },
        {
            "supplier_name": "shopify_matrixify",
            "display_name": "Shopify Matrixify/Excelify",
            "description": "Shopify Matrixify/Excelify CSV import format for bulk deletion",
            "format_schema": {
                "columns": ["ID", "Command"],
                "column_order": ["ID", "Command"],
                "mappings": {
                    "ID": {
                        "source": "item_id",
                        "type": "string"
                    },
                    "Command": {
                        "value": "DELETE",
                        "type": "string"
                    }
                }
            }
        },
        {
            "supplier_name": "shopify_tagging",
            "display_name": "Shopify Tagging Method",
            "description": "Shopify tagging method - users upload to tag items, then filter & delete manually",
            "format_schema": {
                "columns": ["Handle", "Tags"],
                "column_order": ["Handle", "Tags"],
                "mappings": {
                    "Handle": {
                        "source": "handle",
                        "fallback": "sku",
                        "type": "string"
                    },
                    "Tags": {
                        "value": "OptListing_Delete",
                        "type": "string"
                    }
                }
            }
        },
        {
            "supplier_name": "ebay",
            "display_name": "eBay File Exchange",
            "description": "eBay File Exchange CSV format for bulk listing deletion",
            "format_schema": {
                "columns": ["Action", "ItemID"],
                "column_order": ["Action", "ItemID"],
                "mappings": {
                    "Action": {
                        "value": "End",
                        "type": "string"
                    },
                    "ItemID": {
                        "source": "item_id",
                        "type": "string"
                    }
                }
            }
        },
        {
            "supplier_name": "yaballe",
            "display_name": "Yaballe",
            "description": "Yaballe CSV import format for bulk deletion",
            "format_schema": {
                "columns": ["Monitor ID", "Action"],
                "column_order": ["Monitor ID", "Action"],
                "mappings": {
                    "Monitor ID": {
                        "source": "supplier_id",
                        "fallback": "sku",
                        "type": "string"
                    },
                    "Action": {
                        "value": "DELETE",
                        "type": "string"
                    }
                }
            }
        }
    ]
    
    for format_data in formats:
        # Check if format already exists
        existing = db.query(CSVFormat).filter(
            CSVFormat.supplier_name == format_data["supplier_name"]
        ).first()
        
        if existing:
            # Update existing format
            existing.display_name = format_data["display_name"]
            existing.description = format_data["description"]
            existing.format_schema = format_data["format_schema"]
            existing.is_active = True
            print(f"Updated CSV format: {format_data['supplier_name']}")
        else:
            # Create new format
            csv_format = CSVFormat(**format_data)
            db.add(csv_format)
            print(f"Created CSV format: {format_data['supplier_name']}")
    
    db.commit()
    print(f"Successfully initialized {len(formats)} CSV formats")


if __name__ == "__main__":
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    # Initialize CSV formats
    db = SessionLocal()
    try:
        init_csv_formats(db)
    finally:
        db.close()

