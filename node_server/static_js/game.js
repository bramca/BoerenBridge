var host = window.document.location.host.replace(/:.*/, '');

var client = new Colyseus.Client(location.protocol.replace("http", "ws") + "//" + host + (location.port ? ':' + location.port : ''));
var room;
client.joinOrCreate("single_player").then(room_instance => {
    room = room_instance

    var players = {};
    var card_players = {};
    var colors = ['red', 'green', 'yellow', 'blue', 'cyan', 'magenta'];

    // listen to patches coming from the server
    room.state.players.onAdd = function (player, sessionId) {
        var dom = document.createElement("div");
        dom.className = "player";
        dom.style.left = player.x + "px";
        dom.style.top = player.y + "px";
        dom.style.background = colors[Math.floor(Math.random() * colors.length)];
        dom.innerText = "Player " + sessionId;

        player.onChange = function (changes) {
            dom.style.left = player.x + "px";
            dom.style.top = player.y + "px";
        }

        players[sessionId] = dom;
        document.body.appendChild(dom);
        $("#card-table").show();
        card_players[0] = new cards.Hand({faceUp: true, y: 465, x: 0});
        card_players[1] = new cards.Hand({faceUp: false, y: 0, x: -20});
        card_players[2] = new cards.Hand({faceUp: false, y: 165, x: 0});
        card_players[3] = new cards.Hand({faceUp: false, y: 0, x: 600});
    }

    room.state.players.onRemove = function (player, sessionId) {
        document.body.removeChild(players[sessionId]);
        delete players[sessionId];
    }


    room.onMessage("hello", (message) => {
        console.log(message);
    });

    window.addEventListener("keydown", function (e) {
        if (e.which === 38) {
            up();

        } else if (e.which === 39) {
            right();

        } else if (e.which === 40) {
            down();

        } else if (e.which === 37) {
            left();
        }
    });

});

function up () {
    room.send("move", { y: -1 });
}

function right () {
    room.send("move", { x: 1 });
}

function down () {
    room.send("move", { y: 1 })
}

function left () {
    room.send("move", { x: -1 })
}