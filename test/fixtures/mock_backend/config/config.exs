# This file is responsible for configuring your application
# and its dependencies with the aid of the Mix.Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
use Mix.Config

# Configures the endpoint
config :mock_backend, MockBackendWeb.Endpoint,
  url: [host: "localhost"],
  http: [port: 4000],
  secret_key_base: "1Tzh+pJW5+hutcWxmoOGgMIXl9fcQuStNM01xZxjgBLmcx1firpMG9InHVwIeFQ+",
  render_errors: [view: MockBackendWeb.ErrorView, accepts: ~w(json)],
  pubsub: [name: MockBackend.PubSub, adapter: Phoenix.PubSub.PG2]

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason
