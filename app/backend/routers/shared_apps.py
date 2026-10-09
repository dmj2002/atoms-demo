import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.shared_apps import Shared_appsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/shared_apps", tags=["shared_apps"])


# ---------- Pydantic Schemas ----------
class Shared_appsData(BaseModel):
    """Entity data schema (for create/update)"""
    title: str
    html: str


class Shared_appsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    title: Optional[str] = None
    html: Optional[str] = None


class Shared_appsResponse(BaseModel):
    """Entity response schema"""
    id: int
    title: str
    html: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Shared_appsListResponse(BaseModel):
    """List response schema"""
    items: List[Shared_appsResponse]
    total: int
    skip: int
    limit: int


class Shared_appsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Shared_appsData]


class Shared_appsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Shared_appsUpdateData


class Shared_appsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Shared_appsBatchUpdateItem]


class Shared_appsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Shared_appsListResponse)
async def query_shared_appss(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query shared_appss with filtering, sorting, and pagination"""
    logger.debug(f"Querying shared_appss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Shared_appsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        logger.debug(f"Found {result['total']} shared_appss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid shared_apps query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying shared_appss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Shared_appsListResponse)
async def query_shared_appss_all(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query shared_appss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying shared_appss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Shared_appsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} shared_appss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid shared_apps query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying shared_appss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Shared_appsResponse)
async def get_shared_apps(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single shared_apps by ID"""
    logger.debug(f"Fetching shared_apps with id: {id}, fields={fields}")
    
    service = Shared_appsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Shared_apps with id {id} not found")
            raise HTTPException(status_code=404, detail="Shared_apps not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching shared_apps {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Shared_appsResponse, status_code=201)
async def create_shared_apps(
    data: Shared_appsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new shared_apps"""
    logger.debug(f"Creating new shared_apps with data: {data}")
    
    service = Shared_appsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create shared_apps")
        
        logger.info(f"Shared_apps created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating shared_apps: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating shared_apps: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Shared_appsResponse], status_code=201)
async def create_shared_appss_batch(
    request: Shared_appsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple shared_appss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} shared_appss")
    
    service = Shared_appsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} shared_appss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Shared_appsResponse])
async def update_shared_appss_batch(
    request: Shared_appsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple shared_appss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} shared_appss")
    
    service = Shared_appsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} shared_appss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Shared_appsResponse)
async def update_shared_apps(
    id: int,
    data: Shared_appsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing shared_apps"""
    logger.debug(f"Updating shared_apps {id} with data: {data}")

    service = Shared_appsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Shared_apps with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Shared_apps not found")
        
        logger.info(f"Shared_apps {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating shared_apps {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating shared_apps {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_shared_appss_batch(
    request: Shared_appsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple shared_appss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} shared_appss")
    
    service = Shared_appsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} shared_appss successfully")
        return {"message": f"Successfully deleted {deleted_count} shared_appss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_shared_apps(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single shared_apps by ID"""
    logger.debug(f"Deleting shared_apps with id: {id}")
    
    service = Shared_appsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Shared_apps with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Shared_apps not found")
        
        logger.info(f"Shared_apps {id} deleted successfully")
        return {"message": "Shared_apps deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting shared_apps {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")