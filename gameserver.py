import sys
import time
import random
import numpy as np
import asyncio
import websockets
import json
import logging

logging.basicConfig()

cards = ('2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'D', 'K', '1')
suits = ('h', 'd', 's', 'c')
card_points = dict(zip(cards, [i+1 for i in range(len(cards))]))
deck = [c + s for s in suits for c in cards]

USERS = set()

players = list()

game_started = 0

dealer = 0
n_cards = 7
n_players = 4
index = 0

def users_event():
    return json.dumps({"type": "users", "count": len(USERS)})

async def notify_users(message):
    if USERS:  # asyncio.wait doesn't accept an empty list
        await asyncio.wait([user.send(message) for user in USERS])


async def register(websocket):
    USERS.add(websocket)
    global game_started
    if game_started == 1:
        await notify_users(json.dumps({"type": "start", "value": "started"}))
    await notify_users(users_event())


async def unregister(websocket):
    USERS.remove(websocket)
    await notify_users(users_event())

async def game(websocket, path):
    # register(websocket) sends user_event() to websocket
    await register(websocket)
    try:
        async for message in websocket:
            data = json.loads(message)
            if data["action"] == "enter game":
                global players
                if len(players) < 4:
                    await asyncio.wait([websocket.send(json.dumps({"type": "id", "value": len(players)}))])
                    players.append(Player(0, len(players)))
                    await asyncio.wait([websocket.send(json.dumps({"type": "enter", "value": "game.html"}))])
                for player in players:
                    print(player)
            elif data["action"] == "start game":
                players[int(data["id"])].websocket = websocket
                global game_started
                global deck
                global dealer
                global n_cards
                global index
                game_started = 1
                await notify_users(json.dumps({"type": "start", "value": "started", "dealer": dealer}))
                while len(players) < 4:
                    players.append(Player(1, len(players)));
                np.random.shuffle(deck)
                await notify_users(json.dumps({"type": "deck", "value": deck}))
                print(deck)
                for c in range(n_cards):
                    for p in range(n_players):
                        player = players[(dealer + p + 1) % n_players]
                        player.start_new_round()
                        index = player.draw(deck, index, 1)
                for player in players:
                    print(player)
                    player.print_cards()
                await notify_users(json.dumps({"type": "deal", "dealer": dealer ,"n_cards": n_cards}))
            else:
                logging.error("unsupported event: {}", data)
    finally:
        await unregister(websocket)


def cmp_cards(a):
    cards = ('2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'D', 'K', '1')
    suits = ('h', 'd', 's', 'c')
    card_points = dict(zip(cards, [i+1 for i in range(len(cards))]))
    a_points = card_points[a[:-1]] + (suits.index(a[-1])) * len(cards)
    return a_points

class Player:
    cards = list()
    wins = 0
    tricks = 0
    score = 0
    is_ai = 0
    risk_taking = 0
    id = 0

    def __init__(self, is_ai, id):
        self.is_ai = is_ai
        self.risk_taking = random.uniform(0.49, 0.75)
        self.id = id
        self.cards = list()

    def __str__(self):
        return "player {}".format(self.id)
    
    def draw(self, deck, index, n_cards):
        self.cards.extend([deck[i] for i in range(index, index + n_cards)])
        self.cards.sort(key=cmp_cards)
        return index + n_cards

    def print_cards(self):
        print(self.cards)

    def play_card(self, cards_on_table):
        print("your cards:")
        print([str(i) + ". " + self.cards[i] for i in range(0, len(self.cards))])
        while True:
            try:
                card_index = eval(input("Enter card index to play "))
                break
            except KeyboardInterrupt:
                sys.exit(0)
            except:
                continue

        while card_index > len(self.cards) - 1 or card_index < 0:
            print("please enter a valid card index")
            while True:
                try:
                    card_index = eval(input("Enter card index to play "))
                    break
                except KeyboardInterrupt:
                    sys.exit(0)
                except:
                    continue

        # check if player has suit in cards
        if len(cards_on_table) > 0:
            while self.cards[card_index][-1] != cards_on_table[0][-1] and check_player_has_suit(cards_on_table, self.cards):
                print("please play card with the right suit")
                while True:
                    try:
                        card_index = eval(input("Enter card index to play "))
                        break
                    except KeyboardInterrupt:
                        sys.exit(0)
                    except:
                        continue
                    
                while card_index > len(self.cards) - 1 or card_index < 0:
                    print("please enter a valid card index")
                    while True:
                        try:
                            card_index = eval(input("Enter card index to play "))
                            break
                        except KeyboardInterrupt:
                            sys.exit(0)
                        except:
                            continue

            
        return self.cards.pop(card_index)

    def update_wins(self):
        self.wins += 1

    def update_tricks(self, n):
        self.tricks = n

    def calculate_score(self):
        if self.wins != self.tricks:
            self.score += (abs(self.wins - self.tricks) * -2)
        else:
            self.score += (10 + self.tricks * 2)

    def start_new_round(self):
        self.wins = 0
        self.tricks = 0

    def decide_tricks(self, trump, total_tricks, is_dealer):
        cards = ('2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'D', 'K', '1')
        suits = ('h', 'd', 's', 'c')
        card_points = dict(zip(cards, [i+1 for i in range(len(cards))]))
        n_tricks = 0
        for i in range(len(self.cards)):
            odds = (card_points[self.cards[i][:-1]] + len(cards) * (self.cards[i][-1] == trump)) / (2 * len(cards))
            if odds > self.risk_taking:
                n_tricks += 1

        if is_dealer and total_tricks + n_tricks == len(self.cards):
            if n_tricks > 0:
                n_tricks -= 1
            else:
                n_tricks += 1

        self.tricks = n_tricks
        time.sleep(random.randint(1, 3))
        return n_tricks

    def decide_tricks_one_card(self, trump, total_tricks, other_players_cards, is_dealer):
        cards = ('2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'D', 'K', '1')
        suits = ('h', 'd', 's', 'c')
        card_points = dict(zip(cards, [i+1 for i in range(len(cards))]))
        max_odds_other_players = 0
        n_tricks = 0
        for i in range(len(other_players_cards)):
            odds = (card_points[other_players_cards[i][:-1]] + len(cards) * (other_players_cards[i][-1] == trump)) / (2 * len(cards))
            if odds > max_odds_other_players:
                max_odds_other_players = odds
        if (1 - self.risk_taking) > max_odds_other_players:
            n_tricks += 1
            
        if is_dealer and total_tricks + n_tricks == len(self.cards):
            if n_tricks > 0:
                n_tricks -= 1
            else:
                n_tricks += 1

        self.tricks = n_tricks
        time.sleep(random.randint(1, 3))
        return n_tricks

    def decide_card_play(self, trump, cards_on_table):
        cards = ('2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'D', 'K', '1')
        suits = ('h', 'd', 's', 'c')
        card_points = dict(zip(cards, [i+1 for i in range(len(cards))]))
        playable_cards = list()
        card_to_play = 0
        if len(cards_on_table) > 0:
            suit = cards_on_table[0][-1]
            for i in range(len(self.cards)):
                if self.cards[i][-1] == suit:
                    playable_cards.append(i)

        if len(playable_cards) == 0:
            playable_cards = [i for i in range(len(self.cards))]
        
        table_max_odds = 0
        for i in range(len(cards_on_table)):
            odds = (card_points[cards_on_table[i][:-1]] + len(cards) * (cards_on_table[i][-1] == trump)) / (2 * len(cards))
            if odds > table_max_odds:
                table_max_odds = odds
            
        playable_max_odds = 0
        playable_min_odds = 1
        playable_max_odds_card = playable_cards[0]
        playable_min_odds_card = playable_cards[0]
        for i in playable_cards:
            odds = (card_points[self.cards[i][:-1]] + len(cards) * (self.cards[i][-1] == trump)) / (2 * len(cards))
            if odds > playable_max_odds:
                playable_max_odds = odds
                playable_max_odds_card = i
            if odds < playable_min_odds:
                playable_min_odds = odds
                playable_min_odds_card = i
        
        if self.tricks < self.wins and playable_max_odds > table_max_odds:
            card_to_play = playable_max_odds_card
        elif self.tricks < self.wins and playable_max_odds < table_max_odds:
            card_to_play = playable_min_odds_card
        elif self.tricks == self.wins and playable_max_odds < table_max_odds:
            card_to_play = playable_max_odds_card
        elif self.tricks == self.wins and playable_max_odds > table_max_odds:
            card_to_play = playable_min_odds_card
        else:
            card_to_play = playable_min_odds_card
            if random.random() > self.risk_taking:
                # print("taking random card")
                card_to_play = playable_cards[random.randint(0, len(playable_cards) - 1)]
                # card_to_play = playable_max_odds_card


        # print(self.cards)
        # print(playable_cards)
        # print(table_max_odds)
        # print(playable_max_odds)
        # print(self.cards[playable_max_odds_card])
        # print(playable_min_odds)
        # print(self.cards[playable_min_odds_card])
        # print(card_to_play)
        time.sleep(random.randint(1, 3))
        return self.cards.pop(card_to_play)
        

    
def check_player_has_suit(cards_on_table, player_cards):
    for c in player_cards:
        if c[-1] == cards_on_table[0][-1]:
            return True
    
    return False
                    
    
def calculate_winner(cards, cards_on_table, card_points, starting_player, n_players, trump):
    winner = 0
    winner_points = 0
    for k in range(len(cards_on_table)):
        if cards_on_table[k][-1] == cards_on_table[0][-1] or cards_on_table[k][-1] == trump:
            tmp_winner = (starting_player + k) % n_players
            tmp_winner_points = card_points[cards_on_table[k][:-1]] + len(cards) * (cards_on_table[k][-1] == trump)
            if tmp_winner_points > winner_points:
                winner = tmp_winner
                winner_points = tmp_winner_points
    return winner


def main():
    

    start_server = websockets.serve(game, "localhost", 6789)

    asyncio.get_event_loop().run_until_complete(start_server)
    asyncio.get_event_loop().run_forever()
    # cards = ('2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'D', 'K', '1')
    # suits = ('h', 'd', 's', 'c')
    # card_points = dict(zip(cards, [i+1 for i in range(len(cards))]))
    # deck = [c + s for s in suits for c in cards]
    # max_players = 6
    # min_players = 2
    # print("Max number of players is {}, min is {}".format(max_players, min_players))
    # while True:
    #     try:
    #         n_players = eval(input("Enter number of players "))
    #         break
    #     except KeyboardInterrupt:
    #         sys.exit(0)
    #     except:
    #         continue
    
    # while n_players > max_players or n_players < min_players:
    #     while True:
    #         try:
    #             n_players = eval(input("Enter number of players "))
    #             break
    #         except KeyboardInterrupt:
    #             sys.exit(0)
    #         except:
    #             continue
                
    # index = 0
    # n_cards = 7
    # n_rounds = 13
    # dealer = 0
    # cards_up = -1
    # players = [Player(1) for i in range(n_players)]
    # players[0].is_ai = 0
    # # start the game
    # for i in range(n_rounds):
    #     print("___________________ round {} ____________________".format(i + 1))
    #     print("dealer is player {}".format(dealer))
    #     cards_on_table = list()
    #     np.random.shuffle(deck)
    #     index = 0
    #     for P in range(n_players):
    #         player = players[(dealer + p + 1) % n_players]
    #         player.start_new_round()
    #         index = player.draw(deck, index, n_cards)
            
    #     trump = deck[index][-1]
    #     trump_card = deck[index]
    #     print("trump card: {}".format(trump_card))
    #     index += 1
    #     starting_player = (dealer + 1) % n_players
    #     player_deciding = starting_player
        
    #     # the playing of the round
    #     print("each player decides his tricks, player {} starts".format(starting_player))
    #     total_tricks = 0
    #     # players decide tricks
    #     for j in range(n_players):
    #         print("_________ player {} ________".format(player_deciding))
    #         n_tricks = 0
    #         if players[player_deciding].is_ai:
    #             print("player is ai")
    #             if n_cards != 1:
    #                 n_tricks = players[player_deciding].decide_tricks(trump, total_tricks, (player_deciding == dealer))
    #             else:
    #                 cards_up = 1
    #                 other_players_cards = list()
    #                 for k in range(n_players):
    #                     if k != player_deciding:
    #                         other_players_cards.append(players[k].cards[0])
    #                 n_tricks = players[player_deciding].decide_tricks_one_card(trump, total_tricks, other_players_cards, (player_deciding == dealer))
    #             print("tricks chosen: {}".format(n_tricks))
    #         else:
    #             if n_cards != 1:
    #                 players[player_deciding].print_cards()
    #             else:
    #                 cards_up = 1
    #                 for k in range(n_players):
    #                     if k != player_deciding:
    #                         print("player {} cards:".format(k))
    #                         players[k].print_cards()
    #             print("total number of tricks: {}".format(total_tricks))
    #             while True:
    #                 try:
    #                     n_tricks = eval(input("Enter number of tricks "))
    #                     break
    #                 except KeyboardInterrupt:
    #                     sys.exit(0)
    #                 except:
    #                     continue
                    
    #             if player_deciding != dealer:
    #                 while n_tricks > n_cards or n_tricks < 0:
    #                     print("please enter a valid number of tricks")
    #                     while True:
    #                         try:
    #                             n_tricks = eval(input("Enter number of tricks "))
    #                             break
    #                         except KeyboardInterrupt:
    #                             sys.exit(0)
    #                         except:
    #                             continue
                    
    #             else:
    #                 while n_tricks > n_cards or n_tricks < 0 or (total_tricks + n_tricks) == n_cards:
    #                     print("please enter a valid number of tricks")
    #                     while True:
    #                         try:
    #                             n_tricks = eval(input("Enter number of tricks "))
    #                             break
    #                         except KeyboardInterrupt:
    #                             sys.exit(0)
    #                         except:
    #                             continue

    #         players[player_deciding].update_tricks(n_tricks)
    #         total_tricks += n_tricks
    #         player_deciding = (player_deciding + 1) % n_players

    #     # round starts
    #     n_cards_in_round = n_cards
    #     for k in range(n_cards):
    #         cards_on_table = list()
    #         print("__________ play {} __________".format(k))
    #         print("player {} starts".format(starting_player))
    #         print("trump card: {}".format(trump_card))
    #         for j in range(n_players):
    #             player_playing = (starting_player + j) % n_players
    #             print("player {} (tricks: {}, wins: {}, score: {}) plays".format(player_playing, players[player_playing].tricks, players[player_playing].wins, players[player_playing].score))
    #             if players[player_playing].is_ai:
    #                 cards_on_table.append(players[player_playing].decide_card_play(trump, cards_on_table))
    #             else:
    #                 cards_on_table.append(players[player_playing].play_card(cards_on_table))
    #             print("cards on table:")
    #             print(cards_on_table)

    #         # calculate winner
    #         winner = calculate_winner(cards, cards_on_table, card_points, starting_player, n_players, trump)
    #         print("the winner is player {}".format(winner))
    #         players[winner].update_wins()
    #         for l in range(n_players):
    #             print("player {} (tricks: {}, wins {})".format(l, players[l].tricks, players[l].wins))
    #         starting_player = winner
    #         time.sleep(2)

    #     # scoring
    #     print("________ scores _______")
    #     for l in range(n_players):
    #         players[l].calculate_score()
    #         print("player {} (tricks: {}, wins: {}, score: {})".format(l, players[l].tricks, players[l].wins, players[l].score))
        
    #     n_cards += cards_up
    #     dealer = (dealer + 1) % n_players
    #     time.sleep(2)
        
if __name__ == "__main__":
    main()
