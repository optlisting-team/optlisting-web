from datetime import date, timedelta
import random
from sqlalchemy.orm import Session
from .models import Listing


def generate_dummy_listings(db: Session, count: int = 50, user_id: str = "default-user"):
    """
    Generate dummy listings for testing
    Mix of Amazon/Walmart, some zombies, some active
    """
    # Clear existing data
    db.query(Listing).delete()
    db.commit()
    
    # Sample data
    titles = [
        "Wireless Bluetooth Headphones",
        "USB-C Charging Cable 6ft",
        "Phone Case with Screen Protector",
        "Laptop Stand Adjustable",
        "Mechanical Keyboard RGB",
        "Wireless Mouse Ergonomic",
        "HDMI Cable 4K 10ft",
        "Webcam 1080p HD",
        "USB Hub 4 Port",
        "Laptop Cooling Pad",
        "Phone Mount Car Vent",
        "Tablet Stand Adjustable",
        "Cable Management Box",
        "Desk Organizer Set",
        "Monitor Stand Riser"
    ]
    
    listings = []
    today = date.today()
    
    # Batch processing for large counts (5000 items)
    batch_size = 500
    total_batches = (count + batch_size - 1) // batch_size
    
    for batch_num in range(total_batches):
        batch_start = batch_num * batch_size
        batch_end = min(batch_start + batch_size, count)
        batch_listings = []
        
        for i in range(batch_start, batch_end):
            # Random title
            title = random.choice(titles) + f" - Model {i+1}"
            
            # Random marketplace (eBay, Amazon, Shopify, Walmart)
            marketplaces = ["eBay", "Amazon", "Shopify", "Walmart"]
            marketplace = random.choice(marketplaces)
            
            # Determine source (diverse suppliers + pro aggregators)
            # Amazon: 15%, Walmart: 12%, AliExpress: 15%, CJ Dropshipping: 12%, 
            # Home Depot: 8%, Wayfair: 6%, Costco: 5%,
            # Pro Aggregators: Wholesale2B: 8%, Spocket: 6%, SaleHoo: 4%, Inventory Source: 3%, Dropified: 2%, Unverified: 4%
            # Note: Unverified items require manual source identification (strict classification policy)
            source_rand = random.random()
            brand = None
            upc = None
            
            if source_rand < 0.15:
                source = "Amazon"
                sku = f"AMZ{random.randint(100000, 999999)}"
                image_url = f"https://ssl-images-amazon.com/images/I/{random.randint(100000, 999999)}.jpg"
                # Add Amazon exclusive brands for forensic detection
                if random.random() < 0.3:  # 30% chance
                    brand = random.choice(["AmazonBasics", "Solimo", "Happy Belly"])
            elif source_rand < 0.27:
                source = "Walmart"
                sku = f"WM{random.randint(100000, 999999)}"
                image_url = f"https://i5.walmartimages.com/asr/{random.randint(100000, 999999)}.jpg"
                # Add Walmart exclusive brands for forensic detection
                if random.random() < 0.4:  # 40% chance
                    brand = random.choice(["Mainstays", "Great Value", "Equate", "Pen+Gear", "Hyper Tough"])
                    # Add Walmart UPC prefix for some items
                    if random.random() < 0.2:  # 20% chance
                        upc = f"681131{random.randint(100000, 999999)}"
            elif source_rand < 0.42:
                source = "AliExpress"
                sku = f"AE{random.randint(100000, 999999)}"
                image_url = f"https://ae01.alicdn.com/kf/{random.randint(100000, 999999)}.jpg"
            elif source_rand < 0.54:
                source = "CJ Dropshipping"
                sku = f"CJ{random.randint(100000, 999999)}"
                image_url = f"https://cdn.cjdropshipping.com/images/{random.randint(100000, 999999)}.jpg"
            elif source_rand < 0.62:
                source = "Home Depot"
                sku = f"HD{random.randint(100000, 999999)}"
                image_url = f"https://images.homedepot-static.com/productImages/{random.randint(100000, 999999)}.jpg"
                # Add Home Depot exclusive brands for forensic detection
                if random.random() < 0.3:  # 30% chance
                    brand = random.choice(["Husky", "HDX", "Glacier Bay"])
            elif source_rand < 0.68:
                source = "Wayfair"
                sku = f"WF{random.randint(100000, 999999)}"
                image_url = f"https://images.wayfair.com/images/{random.randint(100000, 999999)}.jpg"
                # Add Wayfair exclusive brands for forensic detection
                if random.random() < 0.3:  # 30% chance
                    brand = random.choice(["Wayfair Basics", "Mercury Row"])
            elif source_rand < 0.73:
                source = "Costco"
                sku = f"CO{random.randint(100000, 999999)}"
                image_url = f"https://images.costco-static.com/{random.randint(100000, 999999)}.jpg"
                # Add Costco exclusive brands for forensic detection
                if random.random() < 0.5:  # 50% chance
                    brand = random.choice(["Kirkland", "Kirkland Signature"])
            elif source_rand < 0.81:
                source = "Wholesale2B"
                sku = f"W2B{random.randint(100000, 999999)}"
                image_url = f"https://wholesale2b.com/images/{random.randint(100000, 999999)}.jpg"
            elif source_rand < 0.87:
                source = "Spocket"
                sku = f"SPK{random.randint(100000, 999999)}"
                image_url = f"https://spocket.co/images/{random.randint(100000, 999999)}.jpg"
            elif source_rand < 0.91:
                source = "SaleHoo"
                sku = f"SH{random.randint(100000, 999999)}"
                image_url = f"https://salehoo.com/images/{random.randint(100000, 999999)}.jpg"
            elif source_rand < 0.94:
                source = "Inventory Source"
                sku = f"IS{random.randint(100000, 999999)}"
                image_url = f"https://inventorysource.com/images/{random.randint(100000, 999999)}.jpg"
            elif source_rand < 0.96:
                source = "Dropified"
                sku = f"DF{random.randint(100000, 999999)}"
                image_url = f"https://dropified.com/images/{random.randint(100000, 999999)}.jpg"
            else:
                # Unverified: No clear pattern match - requires manual verification
                source = "Unverified"
                sku = f"SKU{random.randint(100000, 999999)}"  # Generic SKU without prefix
                image_url = f"https://example.com/images/{random.randint(100000, 999999)}.jpg"  # Generic domain
            
            # Random price
            price = round(random.uniform(9.99, 199.99), 2)
            
            # Date listed (mix of old and new)
            # Generate exactly 500 active items and 50 zombies
            # First 500 items are active, last 50 are zombies
            is_zombie = i >= 500
            if is_zombie:
                days_ago = random.randint(61, 180)  # 61-180 days ago
            else:
                days_ago = random.randint(1, 59)  # 1-59 days ago
            
            date_listed = today - timedelta(days=days_ago)
            
            # Sold quantity (zombies have 0, active might have some)
            if is_zombie:
                sold_qty = 0
            else:
                sold_qty = random.randint(0, 10)
            
            # Watch count
            watch_count = random.randint(0, 50)
            
            # eBay item ID (unique for up to 99999 items)
            ebay_item_id = f"123456789{i:05d}"
            
            # Update title to include brand if available (for forensic detection)
            if brand:
                title = f"{brand} {title}"
            
            # Determine if product goes through Shopify (30% chance)
            # Shopify 경유 제품: marketplace는 eBay이지만 management_hub가 Shopify
            goes_through_shopify = random.random() < 0.3
            
            # Build metrics JSONB
            metrics = {
                "sales": sold_qty,
                "views": watch_count,
                "price": price,
                "date_listed": date_listed.isoformat()
            }
            
            # Add management_hub to metrics if product goes through Shopify
            if goes_through_shopify:
                metrics["management_hub"] = "Shopify"
            
            # Build analysis_meta JSONB (for CSV export testing)
            analysis_meta = {
                "recommendation": {
                    "action": "delete" if is_zombie else "keep",
                    "reason": "Low interest item" if is_zombie else "Active listing"
                },
                "zombie_score": random.uniform(0.7, 1.0) if is_zombie else random.uniform(0.0, 0.3)
            }
            
            # Add management_hub to analysis_meta as well (for redundancy)
            if goes_through_shopify:
                analysis_meta["management_hub"] = "Shopify"
            
            listing = Listing(
                ebay_item_id=ebay_item_id,
                item_id=ebay_item_id,
                title=title,
                sku=sku,
                image_url=image_url,
                brand=brand,
                upc=upc,
                marketplace=marketplace,
                platform=marketplace,
                source=source,
                supplier_name=source,
                supplier_id=sku,
                user_id=user_id,
                price=price,
                date_listed=date_listed,
                sold_qty=sold_qty,
                watch_count=watch_count,
                metrics=metrics,
                analysis_meta=analysis_meta,
                is_zombie=is_zombie,
                zombie_score=analysis_meta["zombie_score"]
            )
            
            batch_listings.append(listing)
        
        # Add batch to database
        db.add_all(batch_listings)
        db.commit()
        listings.extend(batch_listings)
        
        # Progress indicator
        if (batch_num + 1) % 5 == 0 or batch_num == total_batches - 1:
            print(f"Generated {batch_end}/{count} listings... ({((batch_num + 1) / total_batches * 100):.1f}%)")
    
    print(f"Successfully generated {count} dummy listings")
    return listings

