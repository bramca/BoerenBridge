import express from 'express';
import serveIndex from 'serve-index';
import path from 'path';
import cors from 'cors';
import { createServer } from 'http';
import { Server, LobbyRoom, RelayRoom } from 'colyseus';
import { monitor } from '@colyseus/monitor';

// Import demo room handlers
import { ChatRoom } from "./rooms/01-chat-room";
import { SinglePlayerRoom } from "./rooms/singe-player-room";
import { TwoPlayerRoom } from "./rooms/two-player-room";

const port = Number(process.env.PORT || 2567) + Number(process.env.NODE_APP_INSTANCE || 0);
const app = express();

app.use(cors());
app.use(express.json());

// Attach WebSocket Server on HTTP Server.
const gameServer = new Server({
  server: createServer(app),
  express: app,
  pingInterval: 0,
});

// Define "lobby" room
gameServer.define("lobby", LobbyRoom);

// Define "relay" room
gameServer.define("relay", RelayRoom, { maxClients: 4 })
    .enableRealtimeListing();

// Define "chat" room
gameServer.define("chat", ChatRoom)
    .enableRealtimeListing();

// Register ChatRoom with initial options, as "chat_with_options"
// onInit(options) will receive client join options + options registered here.
gameServer.define("chat_with_options", ChatRoom, {
    custom_options: "you can use me on Room#onCreate"
});

// Define "state_handler" room
gameServer.define("single_player", SinglePlayerRoom)
    .enableRealtimeListing();

gameServer.define("two_player", TwoPlayerRoom)
    .enableRealtimeListing();

app.use('/', serveIndex(path.join(__dirname, "static"), {'icons': true}))
app.use('/', express.static(path.join(__dirname, "static")));
app.use('/', express.static(path.join(__dirname, "static_js")));
app.use('/', express.static(path.join(__dirname, "static_css")));
// (optional) attach web monitoring panel
app.use('/colyseus', monitor());

gameServer.onShutdown(function(){
  console.log(`game server is going down.`);
});

gameServer.listen(port);

// process.on("uncaughtException", (e) => {
//   console.log(e.stack);
//   process.exit(1);
// });

console.log(`Listening on http://localhost:${ port }`);
