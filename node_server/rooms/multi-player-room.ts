import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";

export class Player extends Schema {
    name = "Bot";
    cards = [];
    wins = 0;
    tricks = 0;
    score = 0;
    is_ai = false;
    risk_taking = 0;
    player_id = "";

    constructor(is_ai: boolean, player_id: string) {
        super();
        this.player_id = player_id;
        this.is_ai = is_ai;
    }

    draw(deck: Array<string>, index: number, n_cards: number) {
        for (let i = index; i < index + n_cards; i++) {
            this.cards.push(deck[i]);
        }
        return index + n_cards;
    }

    start_new_round() {
        this.wins = 0;
        this.tricks = 0;
    }

    toString() {
        let result = "__ player " + this.player_id + " (tricks: " + this.tricks + ", wins: " + this.wins + ", score: " + this.score + ")__\n";
        result += "[";
        for (let i = 0; i < this.cards.length - 1; i++) {
            result += i + ": " + this.cards[i] + ", ";
        }
        result += this.cards[this.cards.length - 1] + "]";
        return result;
    }
}

export class State extends Schema {
    @type({ map: Player })
    players = new MapSchema<Player>();
    players_arr = [];
    cards = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "D", "K", "1"];
    suits = ["h", "d", "s", "c"];
    deck = [];
    n_rounds = 13;
    curr_round = 0;
    n_cards = 7;
    dealer = 0;
    // something = "This attribute won't be sent to the client-side";
    constructor() {
        super();
        for (let s of this.suits) {
            for (let c of this.cards) {
                this.deck.push(c + s);
            }
        }
    }

    start_round() {
        this.shuffle_deck();
        console.log(this.deck);
        let index = 0;
        for (let j = 0; j < this.n_cards; j++) {
            for (let i = 0; i < this.players_arr.length; i++) {
                let player = this.players_arr[(this.dealer + i  + 1) % this.players_arr.length];
                player.start_new_round();
                index = player.draw(this.deck, index, 1);
            }
        }
        for (let player of this.players) {
            console.log(player.toString());
        }
    }

    createPlayer(is_ai: boolean, sessionId: string) {
        this.players.set(sessionId, new Player(is_ai, sessionId));
        this.players_arr.push(this.players.get(sessionId));
    }

    removePlayer(sessionId: string) {
        this.players.delete(sessionId);
    }

    movePlayer (sessionId: string, movement: any) {
        // if (movement.x) {
        //     this.players.get(sessionId).x += movement.x * 10;

        // } else if (movement.y) {
        //     this.players.get(sessionId).y += movement.y * 10;
        // }
    }

    shuffle_deck() {
        // for i from n−1 downto 1 do
        //     j ← random integer such that 0 ≤ j ≤ i
        //     exchange a[j] and a[i]
        for (let i = this.deck.length - 1; i >= 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            let b = this.deck[i];
            this.deck[i] = this.deck[j];
            this.deck[j] = b;
        }
    }
}

export class MultiPlayerRoom extends Room<State> {
    maxClients = 4;

    onCreate (options) {
        console.log("MultiPlayerRoom created!", options);

        this.setState(new State());

        this.onMessage("name", (client, data) => {
            console.log("MultiPlayerRoom received message from", client.sessionId, ":", data);
            this.state.players.get(client.sessionId).name = data.name;
        });
        this.onMessage("start_game", (client, data) => {
            console.log("MultiPlayerRoom received message from", client.sessionId, ":", data);
            console.log("starting new game");
            this.maxClients = this.state.players.size;
            while (this.state.players.size < 4) {
                this.state.createPlayer(true, "bot" + (this.state.players.size + 1).toString());
            }
            console.log("max spelers")
            console.log(this.maxClients);
            this.state.start_round();
        });
    }

    onAuth(client, options, req) {
        return true;
    }

    onJoin (client: Client) {
        client.send("ask_name", {});
        this.state.createPlayer(false, client.sessionId);
    }

    onLeave (client) {
        this.state.removePlayer(client.sessionId);
    }

    onDispose () {
        console.log("Dispose MultiPlayerRoom");
    }

}
