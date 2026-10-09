import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.generation_jobs import Generation_jobsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/generation_jobs", tags=["generation_jobs"])


# ---------- Pydantic Schemas ----------
class Generation_jobsData(BaseModel):
    """Entity data schema (for create/update)"""
    job_key: str
    content: str = None
    status: str
    error: str = None


class Generation_jobsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    job_key: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    error: Optional[str] = None


class Generation_jobsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    job_key: str
    content: Optional[str] = None
    status: str
    error: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Generation_jobsListResponse(BaseModel):
    """List response schema"""
    items: List[Generation_jobsResponse]
    total: int
    skip: int
    limit: int


class Generation_jobsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Generation_jobsData]


class Generation_jobsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Generation_jobsUpdateData


class Generation_jobsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Generation_jobsBatchUpdateItem]


class Generation_jobsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Generation_jobsListResponse)
async def query_generation_jobss(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query generation_jobss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying generation_jobss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Generation_jobsService(db)
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
            user_id=str(current_user.id),
        )
        logger.debug(f"Found {result['total']} generation_jobss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid generation_jobs query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying generation_jobss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Generation_jobsListResponse)
async def query_generation_jobss_all(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query generation_jobss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying generation_jobss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Generation_jobsService(db)
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
        logger.debug(f"Found {result['total']} generation_jobss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid generation_jobs query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying generation_jobss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Generation_jobsResponse)
async def get_generation_jobs(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single generation_jobs by ID (user can only see their own records)"""
    logger.debug(f"Fetching generation_jobs with id: {id}, fields={fields}")
    
    service = Generation_jobsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Generation_jobs with id {id} not found")
            raise HTTPException(status_code=404, detail="Generation_jobs not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching generation_jobs {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Generation_jobsResponse, status_code=201)
async def create_generation_jobs(
    data: Generation_jobsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new generation_jobs"""
    logger.debug(f"Creating new generation_jobs with data: {data}")
    
    service = Generation_jobsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create generation_jobs")
        
        logger.info(f"Generation_jobs created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating generation_jobs: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating generation_jobs: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Generation_jobsResponse], status_code=201)
async def create_generation_jobss_batch(
    request: Generation_jobsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple generation_jobss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} generation_jobss")
    
    service = Generation_jobsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} generation_jobss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Generation_jobsResponse])
async def update_generation_jobss_batch(
    request: Generation_jobsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple generation_jobss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} generation_jobss")
    
    service = Generation_jobsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} generation_jobss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Generation_jobsResponse)
async def update_generation_jobs(
    id: int,
    data: Generation_jobsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing generation_jobs (requires ownership)"""
    logger.debug(f"Updating generation_jobs {id} with data: {data}")

    service = Generation_jobsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Generation_jobs with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Generation_jobs not found")
        
        logger.info(f"Generation_jobs {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating generation_jobs {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating generation_jobs {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_generation_jobss_batch(
    request: Generation_jobsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple generation_jobss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} generation_jobss")
    
    service = Generation_jobsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} generation_jobss successfully")
        return {"message": f"Successfully deleted {deleted_count} generation_jobss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_generation_jobs(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single generation_jobs by ID (requires ownership)"""
    logger.debug(f"Deleting generation_jobs with id: {id}")
    
    service = Generation_jobsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Generation_jobs with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Generation_jobs not found")
        
        logger.info(f"Generation_jobs {id} deleted successfully")
        return {"message": "Generation_jobs deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting generation_jobs {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")