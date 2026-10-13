import os
from fastapi import FastAPI
from strawberry.fastapi import GraphQLRouter
import strawberry
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "")
supabase: Client = create_client(url, key)

@strawberry.type
class User:
    id: strawberry.ID
    email: str

@strawberry.type
class Query:
    @strawberry.field
    def me(self) -> User:
        # shortcut: just returns first user for demo
        res = supabase.table("users").select("*").limit(1).execute()
        user = res.data[0]
        return User(id=strawberry.ID(user["id"]), email=user["email"])

@strawberry.type
class Mutation:
    @strawberry.mutation
    def login(self, email: str, password: str) -> str:
        # shortcut: mockup login, doesn't actually verify password
        return f"Logged in as {email}"

schema = strawberry.Schema(query=Query, mutation=Mutation)
graphql_app = GraphQLRouter(schema)

app = FastAPI()
app.include_router(graphql_app, prefix="/graphql")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
