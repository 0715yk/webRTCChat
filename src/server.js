import http from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
import express from "express";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer, {
  cors: {
    origin: ["https://admin.socket.io"],
    credentials: true,
  },
});

instrument(wsServer, {
  auth: false,
});

function publicRooms() {
  const {
    sockets: {
      adapter: { sids, rooms },
    },
  } = wsServer;
  const publicRooms = [];
  rooms.forEach((_, key) => {
    if (sids.get(key) === undefined) {
      publicRooms.push(key);
    }
  });
  return publicRooms;
}

function countRoom(roomName) {
  return wsServer.sockets.adapter.rooms.get(roomName)?.size;
}

wsServer.on("connection", (socket) => {
  socket["nickname"] = "익명 사용자";
  socket.onAny((event) => {
    const adapter = wsServer.sockets.adapter;

    console.log(adapter.rooms);
    console.log(adapter.sids);
    console.log(`Socet Event: ${event}`);
  });
  socket.on("enter_room", (roomName, done) => {
    done();
    socket.join(roomName);
    socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));
    console.log(publicRooms());
    wsServer.sockets.emit("room_change", publicRooms());
  });

  socket.on("new_message", (message, roomName, done) => {
    done();
    socket.to(roomName).emit("new_message", `${socket.nickname} : ${message}`);
  });

  socket.on("nickname", (nickname) => {
    socket["nickname"] = nickname;
  });

  socket.on("disconnecting", () => {
    socket.rooms.forEach((room) =>
      socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1)
    );
  });

  socket.on("disconnect", () => {
    wsServer.sockets.emit("room_change", publicRooms());
  });
});

const handleListen = () => console.log("Listening on http://localhost:3000");
httpServer.listen(3000, handleListen);
