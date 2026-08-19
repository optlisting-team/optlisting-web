import ast
import sys

files = [
    'backend/models.py',
    'backend/services.py',
    'backend/ebay_webhook.py'
]

for f in files:
    try:
        ast.parse(open(f, encoding='utf-8').read())
        print(f + ' OK')
    except Exception as e:
        print(f + ' ERROR:', e)
        sys.exit(1)
print('Syntax OK')
