defmodule MockBackendWeb.Router do
  use MockBackendWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", MockBackendWeb do
    pipe_through :api

    get "/status", ApiController, :status
  end
end
