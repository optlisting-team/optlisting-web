# OptListing - Zombie Listing Detector

SaaS application to help eBay dropshippers identify "Zombie Listings" (dead stock) and generate CSV files for bulk deletion in listing tools like AutoDS, Yaballe, and eBay File Exchange.

## Tech Stack

- **Backend:** Python FastAPI
- **Data Processing:** Pandas
- **Database:** SQLite + SQLAlchemy
- **Frontend:** React + Vite + Tailwind CSS

## Project Structure

```
optlisting/
├── backend/
│   ├── main.py          # FastAPI application
│   ├── models.py        # Database models
│   ├── services.py      # Business logic (Source Detective, CSV generation)
│   ├── dummy_data.py    # Dummy data generator
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Quick Start

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. (Optional) Set up environment variables:
```bash
# Copy .env.example to .env.local and modify as needed
cp .env.example .env.local
```

4. Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Features

### Source Detective
Automatically detects the source (Amazon, Walmart, or Unknown) based on:
- Image URL patterns
- SKU prefixes

### Zombie Filter
Identifies listings that are:
- Older than 60 days
- Have 0 sales

### Smart Export
Generates CSV files formatted for:
- **AutoDS:** `Source ID`, `File Action`
- **Yaballe:** `Monitor ID`, `Action`
- **eBay File Exchange:** `Action`, `ItemID`

## API Endpoints

- `GET /api/listings` - Get all listings
- `GET /api/analyze` - Analyze zombie listings
- `POST /api/export` - Export CSV for listing tools
- `POST /api/dummy-data` - Generate dummy data for testing

## Development

The backend automatically generates 50 dummy listings on first startup for testing purposes.

## Supabase MCP Integration

This project is configured to use Supabase MCP (Model Context Protocol) for AI-assisted development.

### Setup

1. The MCP configuration is already set up in `.cursor/mcp.json`
2. When you first use Supabase MCP in Cursor, it will prompt you to authenticate
3. A browser window will open for you to login to your Supabase account
4. Grant organization access to the MCP client

### Security Best Practices

- **Don't connect to production**: Use MCP with development projects only
- **Read-only mode**: Consider using read-only mode when connecting to real data
- **Project scoping**: Scope the MCP server to a specific project
- **Manual approval**: Always review tool calls before executing them

For more information, see the [Supabase MCP documentation](https://supabase.com/docs/guides/getting-started/mcp).

