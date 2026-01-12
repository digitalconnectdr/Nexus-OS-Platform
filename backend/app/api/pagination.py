from typing import Optional, Any, Type, List
from fastapi import Query
from pydantic import BaseModel
from sqlalchemy import select, func, or_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

class CommonQueryParams:
    def __init__(
        self,
        page: int = Query(1, ge=1),
        size: int = Query(50, ge=1, le=1000),
        search: Optional[str] = Query(None),
        sort_by: Optional[str] = Query(None)
    ):
        self.page = page
        self.size = size
        self.search = search
        self.sort_by = sort_by

async def apply_pagination_logic(
    db: AsyncSession,
    model: Any,
    params: CommonQueryParams,
    base_query = None,
    search_fields: List[str] = []
):
    # 1. Start with base query or select all
    if base_query is None:
        query = select(model)
    else:
        query = base_query

    # 2. Apply search filters (ILIKE)
    if params.search and search_fields:
        search_filters = []
        for field_name in search_fields:
            attr = getattr(model, field_name)
            search_filters.append(attr.ilike(f"%{params.search}%"))
        query = query.where(or_(*search_filters))

    # 3. Apply sorting
    if params.sort_by:
        field_name = params.sort_by
        is_desc = False
        if field_name.startswith("-"):
            is_desc = True
            field_name = field_name[1:]
        
        if hasattr(model, field_name):
            attr = getattr(model, field_name)
            query = query.order_by(desc(attr) if is_desc else asc(attr))
    else:
        # Default sort by created_at if exists
        if hasattr(model, "created_at"):
            query = query.order_by(desc(model.created_at))

    # 4. Count total
    # We use a subquery to count the filtered results
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # 5. Apply limit/offset
    offset = (params.page - 1) * params.size
    query = query.offset(offset).limit(params.size)

    # 6. Execute items query
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": items,
        "total": total,
        "page": params.page,
        "size": params.size
    }
