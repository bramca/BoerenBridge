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
    id = "";

    constructor(is_ai: boolean, id: string) {
        super();
        this.id = id;
        this.is_ai = is_ai;
        let min = 0.49;
        let max = 0.75;
        this.risk_taking = Math.random() * (max - min) + min;
    }

    draw(deck: Array<string>, index: number, n_cards: number) {
        for (let i = index; i < index + n_cards; i++) {
            this.cards.push(deck[i]);
        }
        return index + n_cards;
    }

    start_new_round() {
        this.tricks = 0;
        this.cards = [];
    }

    async play_card(state, room) {
        let t_cards = state.cards;
        let suits = state.suits;
        let card_points = {};
        for (let i = 0; i < t_cards.length; i++) {
            card_points[t_cards[i]] = i + 1;
        }
        let playable_cards = [];
        if (state.cards_on_table.length > 0) {
            let suit = state.cards_on_table[0][state.cards_on_table[0].length - 1];
            for (let i = 0; i < this.cards.length; i++) {
                if (this.cards[i][this.cards[i].length - 1] == suit) {
                    playable_cards.push(i);
                }
            }
        }
        if (playable_cards.length == 0) {
            for (let i = 0; i < this.cards.length; i++) {
                playable_cards.push(i);
            }
        }
        let table_max_odds = 0;
        for (let i = 0; i < state.cards_on_table.length; i++) {
            let odds = (card_points[state.cards_on_table[i].substr(0, state.cards_on_table[i].length - 1)] + t_cards.length * (state.cards_on_table[i][state.cards_on_table[i].length - 1] === state.get_trump_card()[state.get_trump_card().length - 1] ? 1 : 0) / (2 * t_cards.length));
            if (odds > table_max_odds) {
                table_max_odds = odds;
            }
        }
        let playable_max_odds = 0;
        let playable_min_odds = 1;
        let playable_max_odds_card = playable_cards[0];
        let playable_min_odds_card = playable_cards[0];
        for (let j = 0; j < playable_cards.length; j++) {
            let i = playable_cards[j];
            let odds = (card_points[this.cards[i].substr(0, this.cards[i].length - 1)] + t_cards.length * (this.cards[i][this.cards[i].length - 1] == state.get_trump_card()[state.get_trump_card().length - 1] ? 1 : 0)) / (2 * t_cards.length);
            if (odds > playable_max_odds) {
                playable_max_odds = odds;
                playable_max_odds_card = i;
            }
            if (odds < playable_min_odds) {
                playable_min_odds = odds;
                playable_min_odds_card = i;
            }
        }
        let card_to_play = playable_cards[0];
        if (this.tricks < this.wins && playable_max_odds > table_max_odds) {
            card_to_play = playable_max_odds_card;
        } else if (this.tricks < this.wins && playable_max_odds < table_max_odds) {
            card_to_play = playable_min_odds_card;
        } else if (this.tricks == this.wins && playable_max_odds < table_max_odds) {
            card_to_play = playable_max_odds_card;
        } else if (this.tricks == this.wins && playable_max_odds > table_max_odds) {
            card_to_play = playable_min_odds_card;
        } else {
            card_to_play = playable_min_odds_card;
            if (Math.random() > this.risk_taking) {
                card_to_play = playable_cards[Math.floor(Math.random() * playable_cards.length)];
            }
        }
        let card = this.cards[card_to_play];
        this.cards.splice(card_to_play, 1);
        state.cards_on_table.push(card);
        await state.sleep(3000);
        for (let player of state.players) {
            if (!player[1].is_ai && player[1].id != this.id) {
                state.cls[player[1].id].send("broadcast_card_played", {"id": this.id, "card": card});
            }
        }

        // send play_card to the next players check if its not the last one
        state.play_count += 1;
        if (state.play_count < state.players_arr.length) {
            state.curr_player_index = (state.starting_player + state.play_count) % state.players_arr.length;
            let curr_player = state.players_arr[state.curr_player_index];
            if (!curr_player.is_ai) {
                console.log(curr_player.id + " decides a card");
                await state.sleep(3000);
                state.cls[curr_player.id].send("play_card", { "id": curr_player.id, "cards_on_table": state.cards_on_table });
            } else {
                console.log(curr_player.id + " ai decides play card");
                curr_player.play_card(state, room);
            }
        } else {
            console.log("decide winner (after last ai played) and redo play");
            state.calculate_winner(room);
        }
    }

    async decide_tricks(state, room) {
        let t_cards = state.cards;
        let suits = state.suits;
        let card_points = {};
        let n_tricks = 0;
        let is_dealer = (state.curr_player_index == state.dealer);
        for (let i = 0; i < t_cards.length; i++) {
            card_points[t_cards[i]] = i + 1;
        }
        for (let i = 0; i < this.cards.length; i++) {
            let odds = (card_points[this.cards[i].substr(0, this.cards[i].length - 1)] + t_cards.length * (this.cards[i][this.cards[i].length - 1] == state.get_trump_card()[state.get_trump_card().length - 1] ? 1 : 0)) / (2 * t_cards.length);
            if (odds > this.risk_taking) {
                n_tricks += 1;
            }
        }
        if (is_dealer && state.total_tricks + n_tricks == this.cards.length) {
            if (n_tricks > 0) {
                n_tricks -= 1;
            } else {
                n_tricks += 1;
            }
        }
        this.tricks = n_tricks;
        state.total_tricks += n_tricks;
        state.decision_count += 1;
        console.log("this.tricks: " + this.tricks);
        room.broadcast("tricks_decided", { "id": this.id, "total_tricks": state.total_tricks, "n_tricks": this.tricks });
        // check if not the latest player
        if (state.decision_count < state.players_arr.length) {
            // set state.curr_player_index and state.decision_count accordingly
            state.curr_player_index = (state.starting_player + state.decision_count) % state.players_arr.length;
            let curr_player = state.players_arr[state.curr_player_index];
            // call state.cls[curr_player_index].send("decide_tricks", data) if needed else call this function recursively
            if (!curr_player.is_ai) {
                console.log(curr_player.id + " decides tricks");
                await state.sleep(3000);
                state.cls[curr_player.id].send("decide_tricks", { "id": curr_player.id, "total_tricks": state.total_tricks, "is_dealer": (state.curr_player_index == state.dealer) });
            } else {
                console.log(curr_player.id + " ai decides tricks");
                curr_player.decide_tricks(state, room);
            }
        } else {
            // game can start
            console.log("game can start (after bot)");
            for (let player of state.players) {
                console.log(player[1].toString());
            }
            state.curr_player_index = (state.starting_player + state.play_count) % state.players_arr.length;
            let curr_player = state.players_arr[state.curr_player_index];
            if (!curr_player.is_ai) {
                console.log(curr_player.id + " decides a card");
                state.cls[curr_player.id].send("play_card", { "id": curr_player.id, "cards_on_table": state.cards_on_table });
            } else {
                console.log(curr_player.id + " ai decides play card");
                curr_player.play_card(state, room);
            }
        }
    }

    toString() {
        let name = this.name;
        if (this.is_ai) {
            name = this.id;
        }
        let result = "__ player " + this.id + " (tricks: " + this.tricks + ", wins: " + this.wins + ", score: " + this.score + ")__\n";
        result += "[";
        for (let i = 0; i < this.cards.length - 1; i++) {
            result += i + ": " + this.cards[i] + ", ";
        }
        result += (this.cards.length - 1) + ": " + this.cards[this.cards.length - 1] + "]";
        return result;
    }
}

export class State extends Schema {
    @type({ map: Player })
    players = new MapSchema<Player>();
    cls = new MapSchema<Client>();
    players_arr = [];
    cards = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "D", "K", "1"];
    suits = ["h", "d", "s", "c"];
    deck = [];
    n_rounds = 13;
    curr_round = 0;
    n_cards = 2;
    dealer = 0;
    deck_index = 0;
    total_tricks = 0;
    curr_player_index = 0;
    starting_player = 0;
    decision_count = 0;
    can_start_decide = 0;
    can_start_next = 0;
    play_count = 0;
    cards_on_table = [];
    sleep = (milliseconds) => {
        return new Promise(resolve => setTimeout(resolve, milliseconds))
    }
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
        let index = this.deck_index;
        for (let i = 0; i < this.players_arr.length; i++) {
            let player = this.players_arr[(this.dealer + i  + 1) % this.players_arr.length];
            player.start_new_round();
        }
        for (let j = 0; j < this.n_cards; j++) {
            for (let i = 0; i < this.players_arr.length; i++) {
                let player = this.players_arr[(this.dealer + i  + 1) % this.players_arr.length];
                index = player.draw(this.deck, index, 1);
            }
        }
        console.log(this.deck);
        this.deck_index = index;
    }

    async calculate_winner(room) {
        let t_cards = this.cards;
        let suits = this.suits;
        let card_points = {};
        for (let i = 0; i < t_cards.length; i++) {
            card_points[t_cards[i]] = i + 1;
        }
        let winner = 0;
        let winner_points = 0;
        for (let i = 0; i < this.cards_on_table.length; i++) {
            if (this.cards_on_table[i][this.cards_on_table[i].length - 1] == this.cards_on_table[0][this.cards_on_table[0].length - 1] || this.cards_on_table[i][this.cards_on_table[i].length - 1] == this.get_trump_card()[this.get_trump_card().length - 1]) {
                let tmp_winner = (this.starting_player + i) % this.players_arr.length;
                let tmp_winner_points = card_points[this.cards_on_table[i].substr(0, this.cards_on_table[i].length - 1)] + t_cards.length * (this.cards_on_table[i][this.cards_on_table[i].length - 1] == this.get_trump_card()[this.get_trump_card().length - 1] ? 1 : 0);
                console.log("tmp_winner: " + tmp_winner);
                console.log("tmp_winner_points: " + tmp_winner_points);
                console.log("tmp_winner card: " + this.cards_on_table[i]);
                if (tmp_winner_points > winner_points) {
                    winner = tmp_winner;
                    winner_points = tmp_winner_points;
                }
            }
        }
        this.players_arr[winner].wins += 1;
        console.log("winner is " + this.players_arr[winner].toString());
        await this.sleep(2000);
        for (let player of this.players) {
            if (!player[1].is_ai) {
                this.cls[player[1].id].send("broadcast_winner", { "id": this.players_arr[winner].id, "wins": this.players_arr[winner].wins });
            }
        }
        this.starting_player = winner;
        // todo check if starting player still has cards to play
        if (this.players_arr[this.starting_player].cards.length == 0) {
            let scores = {};
            console.log("calculating round winner")
            for (var i = 0; i < this.players_arr.length; i++) {
                let player = this.players_arr[i];
                if (player.tricks == player.wins) {
                    player.score += (10 + player.tricks * 2);
                } else {
                    player.score -= (Math.abs(player.tricks - player.wins) * 2);
                }
                scores[player.id] = player.score;
            }
            for (var i = 0; i < this.players_arr.length; i++) {
                let player = this.players_arr[i];
                console.log("player info: " + player.toString());
                if (!player.is_ai) {
                    this.cls[player.id].send("broadcast_scores", { "scores": scores });
                }
            }
            this.n_cards -= 1;
        } else {
            this.play_count = 0;
            this.can_start_next = 0;
            this.cards_on_table = [];
        }
    }

    get_trump_card() {
        return this.deck[this.deck_index];
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
        console.log("max spelers: " + this.maxClients);

        this.setState(new State());

        this.onMessage("name", (client, data) => {
            console.log("MultiPlayerRoom received message from", client.sessionId, ":", data);
            this.state.players.get(client.sessionId).name = data.name;
            for (let player of this.state.players) {
                if (player[1].id != client.sessionId) {
                    this.state.cls[player[1].id].send("broadcast_name", {"id": client.sessionId, "name": data.name})
                }
            }
        });
        this.onMessage("start_game", (client, data) => {
            console.log("MultiPlayerRoom received message from", client.sessionId, ":", data);
            console.log("starting new game");
            this.maxClients = this.state.players.size;
            while (this.state.players.size < 4) {
                this.state.createPlayer(true, "bot" + (this.state.players.size + 1).toString());
                this.state.players["bot" + this.state.players.size].name += this.state.players.size + 1;
            }
            // lock the room when the game starts
            this.lock();
            console.log("max spelers: " + this.maxClients);
            this.state.start_round();
            // round started
            console.log("round started");
            this.broadcast("deck_shuffled", this.state.deck);
            for (let player of this.state.players) {
                console.log(player[1].toString());
                if (!player[1].is_ai) {
                    console.log("sending draw cards message to " + player[1].toString() + " with id: " + player[1].id);
                    this.state.cls[player[1].id].send("draw_cards", player[1].cards);
                }
            }
            console.log("trump card: " + this.state.get_trump_card());
            this.broadcast("trump_card", this.state.get_trump_card());
            this.broadcast("dealer", this.state.players_arr[this.state.dealer].id)
            this.state.starting_player = (this.state.dealer + 1) % this.state.players_arr.length;
        });

        this.onMessage("start_next_round", async (client, data) => {
            console.log("received start_next_round");
            this.state.can_start_next += 1;
            console.log("received from " + this.state.can_start_next + " clients");
            if (this.state.can_start_next == this.maxClients) {
                console.log("next round can start (after winner previous round)");
                for (let player of this.state.players) {
                    console.log(player[1].toString());
                }
                this.state.curr_player_index = (this.state.starting_player + this.state.play_count) % this.state.players_arr.length;
                let curr_player = this.state.players_arr[this.state.curr_player_index];
                if (!curr_player.is_ai) {
                    console.log(curr_player.id + " decides a card");
                    this.state.cls[curr_player.id].send("play_card", { "id": curr_player.id, "cards_on_table": this.state.cards_on_table });
                } else {
                    console.log(curr_player.id + " ai decides play card");
                    curr_player.play_card(this.state, this);
                }
            }
        });

        this.onMessage("start_decide_tricks", async (client, data) => {
            console.log("received start_decide_tricks");
            this.state.can_start_decide += 1;
            console.log("received from " + this.state.can_start_decide + " clients");
            if (this.state.can_start_decide == this.maxClients) {
                this.state.curr_player_index = (this.state.starting_player + this.state.decision_count) % this.state.players_arr.length;
                let curr_player = this.state.players_arr[this.state.curr_player_index];
                if (!curr_player.is_ai) {
                    console.log(curr_player.id + " decides tricks");
                    await this.state.sleep(3000);
                    this.state.cls[curr_player.id].send("decide_tricks", { "id": curr_player.id, "total_tricks": this.state.total_tricks, "is_dealer": (this.state.curr_player_index == this.state.dealer) });
                } else {
                    console.log(curr_player.id + " ai decides tricks");
                    curr_player.decide_tricks(this.state, this);
                }
            }
        });

        this.onMessage("player_tricks_decided", async (client, data) => {
            console.log("received player_tricks_decided from player " + client.sessionId + ", n_tricks: " + data.n_tricks);
            this.state.players[client.sessionId].tricks = data.n_tricks;
            this.state.total_tricks += parseInt(data.n_tricks);
            console.log("total_tricks: " + this.state.total_tricks);
            this.broadcast("tricks_decided", { "id": client.sessionId, "total_tricks": this.state.total_tricks, "n_tricks": data.n_tricks });
            this.state.decision_count += 1;
            if (this.state.decision_count < this.state.players_arr.length) {
                this.state.curr_player_index = (this.state.starting_player + this.state.decision_count) % this.state.players_arr.length;
                let curr_player = this.state.players_arr[this.state.curr_player_index];
                if (!curr_player.is_ai) {
                    console.log(curr_player.id + " decides tricks");
                    await this.state.sleep(2000);
                    this.state.cls[curr_player.id].send("decide_tricks", { "id": curr_player.id, "total_tricks": this.state.total_tricks, "is_dealer": (this.state.curr_player_index == this.state.dealer) });
                } else {
                    console.log(curr_player.id + " ai decides tricks");
                    curr_player.decide_tricks(this.state, this);
                }
            } else {
                // game can stars
                console.log("game can start (after player)");
                for (let player of this.state.players) {
                    console.log(player[1].toString());
                }
                this.state.curr_player_index = (this.state.starting_player + this.state.play_count) % this.state.players_arr.length;
                let curr_player = this.state.players_arr[this.state.curr_player_index];
                if (!curr_player.is_ai) {
                    console.log(curr_player.id + " decides a card");
                    this.state.cls[curr_player.id].send("play_card", { "id": curr_player.id, "cards_on_table": this.state.cards_on_table });
                } else {
                    console.log(curr_player.id + " ai decides play card");
                    curr_player.play_card(this.state, this);
                }
            }

        });

        this.onMessage("card_played", async (client, data) => {
            console.log("received card_played: " + client.sessionId);
            console.log("card: " + data.card);
            this.state.cards_on_table.push(data.card);
            for (let player of this.state.players) {
                if (!player[1].is_ai && player[1].id != client.sessionId) {
                    this.state.cls[player[1].id].send("broadcast_card_played", {"id": client.sessionId, "card": data.card});
                }
            }
            let card_index = this.state.players_arr[this.state.curr_player_index].cards.indexOf(data.card);
            this.state.players_arr[this.state.curr_player_index].cards.splice(card_index, 1);
            // send play_card to the next players check if its not the last one
            this.state.play_count += 1;
            if (this.state.play_count < this.state.players_arr.length) {
                this.state.curr_player_index = (this.state.starting_player + this.state.play_count) % this.state.players_arr.length;
                let curr_player = this.state.players_arr[this.state.curr_player_index];
                if (!curr_player.is_ai) {
                    console.log(curr_player.id + " decides a card");
                    await this.state.sleep(3000);
                    this.state.cls[curr_player.id].send("play_card", { "id": curr_player.id, "cards_on_table": this.state.cards_on_table });
                } else {
                    console.log(curr_player.id + " ai decides play card");
                    curr_player.play_card(this.state, this);
                }
            } else {
                console.log("decide winner (after last player played) and redo play");
                this.state.calculate_winner(this);
            }
        });
    }

    onAuth(client, options, req) {
        return true;
    }

    onJoin (client: Client) {
        console.log("client: " + client.sessionId + " joined.");
        this.state.cls[client.sessionId] = client;
        let player_names = {};
        console.log("___ players already in the room ___");
        for (let player of this.state.players) {
            console.log("player: " + player[1].name + ", id: " + player[1].id);
            player_names[player[1].id] = player[1].name;
        }
        console.log("______");
        this.state.createPlayer(false, client.sessionId);
        client.send("ask_name", {"id": client.sessionId, "player_names": player_names});
    }

    onLeave (client) {
        this.state.removePlayer(client.sessionId);
    }

    onDispose () {
        console.log("Dispose MultiPlayerRoom");
    }

}
