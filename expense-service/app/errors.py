from fastapi import Request
from fastapi.responses import JSONResponse


class ExpenseNotFoundError(Exception):
    def __init__(self, expense_id: int):
        self.expense_id = expense_id
        self.message = f"هزینه با شناسه {expense_id} پیدا نشد."
        super().__init__(self.message)


async def expense_not_found_handler(
    request: Request, exc: ExpenseNotFoundError
) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content={
            "status": "error",
            "status_code": 404,
            "code": "expense_not_found",
            "message": exc.message,
            "expense_id": exc.expense_id,
        },
    )
