import { server } from "./http";

import "./websocket/ChatService"

server.listen(8888, () => console.log("Server is running!"));