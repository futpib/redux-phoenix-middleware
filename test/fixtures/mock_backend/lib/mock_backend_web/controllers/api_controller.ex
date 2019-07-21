defmodule MockBackendWeb.ApiController do
  use MockBackendWeb, :controller

  def status(conn, _params) do
    conn
    |> send_resp(201, "")
  end
end
