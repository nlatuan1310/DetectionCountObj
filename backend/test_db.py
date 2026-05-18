import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import SessionLocal
from app.services.dataset_svc import DatasetService

async def main():
    async with SessionLocal() as db:
        try:
            projects = await DatasetService.list_projects(db)
            print(f"Success! Found {len(projects)} projects.")
        except Exception as e:
            print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(main())
