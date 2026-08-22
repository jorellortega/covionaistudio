import { setDefaultResultOrder } from "node:dns"

try {
  setDefaultResultOrder("ipv4first")
} catch {
  // Edge / runtimes without this API
}
