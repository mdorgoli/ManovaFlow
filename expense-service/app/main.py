from typing import Annotated

from fastapi import FastAPI, Path, Response
from pydantic import BaseModel, Field

from app.errors import ExpenseNotFoundError, expense_not_found_handler


class ExpenseInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    amount: int = Field(gt=0, description="Amount in whole currency units")


class Expense(ExpenseInput):
    id: int


ExpenseId = Annotated[int, Path(gt=0)]


def create_app() -> FastAPI:
    app = FastAPI(title="Expense service - error handling exercise")
    app.add_exception_handler(ExpenseNotFoundError, expense_not_found_handler)
    expenses: dict[int, Expense] = {}
    next_id = 1

    def find_expense(expense_id: int) -> Expense:
        if expense_id not in expenses:
            raise ExpenseNotFoundError(expense_id)
        return expenses[expense_id]

    @app.post("/expenses", response_model=Expense, status_code=201)
    async def create_expense(payload: ExpenseInput) -> Expense:
        nonlocal next_id
        expense = Expense(id=next_id, **payload.model_dump())
        expenses[next_id] = expense
        next_id += 1
        return expense

    @app.get("/expenses", response_model=list[Expense])
    async def list_expenses() -> list[Expense]:
        return list(expenses.values())

    @app.get("/expenses/{expense_id}", response_model=Expense)
    async def get_expense(expense_id: ExpenseId) -> Expense:
        return find_expense(expense_id)

    @app.delete("/expenses/{expense_id}", status_code=204)
    async def delete_expense(expense_id: ExpenseId) -> Response:
        find_expense(expense_id)
        del expenses[expense_id]
        return Response(status_code=204)

    return app


app = create_app()
