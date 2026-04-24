from fastapi import APIRouter, Request, status

router = APIRouter(prefix="/webhooks", tags=["github"])


@router.post("/github", status_code=status.HTTP_202_ACCEPTED)
async def github_webhook_listener(request: Request) -> dict[str, str]:
    _ = await request.body()
    return {"message": "Webhook received"}
