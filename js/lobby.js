define(function(require) {
	'use strict';

	var common_data = require('common_data'),
		common_functions = require('common_functions'),
		enums = require('enums'),
		network = require('network'),
		pubsub = require('pubsub'),
		current_page = null,
		show_on_game_page = false,
		page_to_position = {},
		initial_loading = true;

	function setPosition() {
		var position = page_to_position[current_page];

		common_functions.setElementPosition($('#lobby'), position.left, position.top, position.width, position.height);
	}

	function setPage(page) {
		current_page = page;

		if (page === 'game') {
			$('#lobby-header, #create-game-section, #lobby-games .game-buttons').hide();
		} else {
			$('#lobby-header, #create-game-section, #lobby-games .game-buttons').show();
		}

		if (page === 'lobby' || (page === 'game' && show_on_game_page)) {
			setPosition();
			$('#lobby').show();
		} else {
			$('#lobby').hide();
		}
	}

	function setShowOnGamePage(show) {
		show_on_game_page = show;

		if (current_page === 'game') {
			setPage(current_page);
		}
	}

	function setPositionForPage(page, left, top, width, height) {
		page_to_position[page] = {
			left: left,
			top: top,
			width: width,
			height: height
		};

		if (page === current_page) {
			setPosition();
		}
	}

	function showElement($element, num_lines) {
		if (initial_loading) {
			$element.show();
		} else {
			$element.slideDown(250 * num_lines);
		}
	}

	function removeElement($element, num_lines) {
		if (initial_loading) {
			$element.remove();
		} else {
			$element.slideUp(250 * num_lines, function() {
				$element.remove();
			});
		}
	}

	function addLobbyClient(client_id) {
		var $div = $('<div/>'),
			client_data = common_data.client_id_to_data[client_id];

		$div.attr('class', 'client-' + client_id);
		$div.attr('title', client_data.username + ' (' + client_data.ip_address + ')');
		$div.text(client_data.username);
		$div.hide();
		$div.appendTo('#clients-in-lobby');
		showElement($div, 1);
	}

	function removeLobbyClient(client_id) {
		var $div = $('#clients-in-lobby .client-' + client_id);

		removeElement($div, 1);
	}

	function removeUnusedPlayerDivs(game_id) {
		var state_id = common_data.game_id_to_state_id[game_id],
			number_of_players = common_data.game_id_to_number_of_players[game_id],
			max_players = common_data.game_id_to_max_players[game_id],
			num_divs_to_remove = max_players - number_of_players,
			player_id, $player;

		if (state_id !== enums.GameStates.Starting) {
			for (player_id = max_players - 1; player_id >= number_of_players; player_id--) {
				$player = $('#lobby-game-' + game_id + ' .player:eq(' + player_id + ')');
				removeElement($player, num_divs_to_remove);
			}
		}
	}

	function setGameState(game_id) {
		var $lobby_section = $('#lobby-game-' + game_id),
			$players, $player, max_players = common_data.game_id_to_max_players[game_id],
			i, state_id = common_data.game_id_to_state_id[game_id],
			in_this_game, player_id, player_data = common_data.game_id_to_player_data[game_id],
			client_username = common_data.client_id_to_data[common_data.client_id].username;

		// create and add lobby section if it doesn't exist
		if ($lobby_section.length === 0) {
			$lobby_section = $('#lobby-game-template').clone();
			$lobby_section.attr('id', 'lobby-game-' + game_id);
			$lobby_section.attr('data-game-id', game_id);
			$lobby_section.find('.header').text('Game #' + game_id);
			$players = $lobby_section.find('.players');
			$player = $players.find('.player');
			for (i = 1; i < max_players; i++) {
				$players.append($player.clone());
			}
			if (current_page === 'game') {
				$lobby_section.find('.game-buttons').hide();
			}
			$lobby_section.hide();
			$('#lobby-games').prepend($lobby_section);
			showElement($lobby_section, max_players + 2);
		}

		// set game state text
		$lobby_section.find('.state').text(common_functions.getGameStateText(game_id));

		// is client's username in this game?
		in_this_game = false;
		for (player_id in player_data) {
			if (player_data.hasOwnProperty(player_id)) {
				if (player_data[player_id].username === client_username) {
					in_this_game = true;
				}
			}
		}

		// show/hide buttons as appropriate
		if (state_id === enums.GameStates.Starting && !in_this_game) {
			$lobby_section.find('.button-join-game').show();
		} else {
			$lobby_section.find('.button-join-game').hide();
		}

		if (in_this_game) {
			$lobby_section.find('.button-rejoin-game').show();
			$lobby_section.find('.button-watch-game').hide();
		} else {
			$lobby_section.find('.button-rejoin-game').hide();
			$lobby_section.find('.button-watch-game').show();
		}

		// remove unused player divs
		if (!initial_loading) {
			removeUnusedPlayerDivs(game_id);
		}
	}

	function setGamePlayerData(game_id, player_id, username, client_id) {
		var $player = $('#lobby-game-' + game_id + ' .player:eq(' + player_id + ')'),
			ip_address;

		if (client_id === null) {
			$player.addClass('missing');
			ip_address = 'missing';
		} else {
			$player.removeClass('missing');
			ip_address = common_data.client_id_to_data[client_id].ip_address;
		}
		$player.attr('title', username + ' (' + ip_address + ')');
		$player.text(username);

		setGameState(game_id);
	}

	function addGameWatcher(game_id, client_id) {
		var $div = $('<div/>'),
			client_data = common_data.client_id_to_data[client_id];

		$div.attr('class', 'client-' + client_id);
		$div.attr('title', client_data.username + ' (' + client_data.ip_address + ')');
		$div.text(client_data.username);
		$div.hide();
		$div.appendTo('#lobby-game-' + game_id + ' .watchers');
		showElement($div, 1);
	}

	function removeGameWatcher(game_id, client_id) {
		var $div = $('#lobby-game-' + game_id + ' .watchers .client-' + client_id);

		removeElement($div, 1);
	}

	function destroyGame(game_id) {
		var $div = $('#lobby-game-' + game_id),
			num_players = $div.find('tr').length;

		$div.find('.game-buttons input').prop('disabled', true);
		removeElement($div, num_players + 2);
	}

	function createGameSelectChanged() {
		/* jshint validthis:true */
		var $this = $(this),
			id = $this.attr('id'),
			value = $this.val();

		switch (id) {
		case 'cg-mode':
			if (value === 'Singles') {
				$('#cg-span-max-players').show();
			} else if (value === 'Teams') {
				$('#cg-span-max-players').hide();
			}
			break;
		}
	}

	function createGameButtonClicked() {
		network.sendMessage(enums.CommandsToServer.CreateGame, enums.GameModes[$('#cg-mode').val()], parseInt($('#cg-max-players').val(), 10));
	}

	function gameButtonClicked() {
		/* jshint validthis:true */
		var $this = $(this),
			game_id = parseInt($this.closest('.lobby-section').attr('data-game-id'), 10);

		if ($this.hasClass('button-join-game')) {
			network.sendMessage(enums.CommandsToServer.JoinGame, game_id);
		} else if ($this.hasClass('button-rejoin-game')) {
			network.sendMessage(enums.CommandsToServer.RejoinGame, game_id);
		} else if ($this.hasClass('button-watch-game')) {
			network.sendMessage(enums.CommandsToServer.WatchGame, game_id);
		}
	}

	function messageProcessingComplete() {
		var game_id_to_state_id, game_id;

		if (initial_loading) {
			game_id_to_state_id = common_data.game_id_to_state_id;
			for (game_id in game_id_to_state_id) {
				if (game_id_to_state_id.hasOwnProperty(game_id)) {
					removeUnusedPlayerDivs(game_id);
				}
			}

			initial_loading = false;
		}
	}

	function reset() {
		$('#clients-in-lobby').empty();
		$('#lobby-games').empty();

		initial_loading = true;
	}

	function onInitializationComplete() {
		$('#create-game-section select').change(createGameSelectChanged);
		$('#button-create-game').click(createGameButtonClicked);
		$('#lobby-games').on('click', 'input', gameButtonClicked);
	}

	pubsub.subscribe(enums.PubSub.Client_SetPage, setPage);
	pubsub.subscribe(enums.PubSub.Client_AddLobbyClient, addLobbyClient);
	pubsub.subscribe(enums.PubSub.Client_RemoveLobbyClient, removeLobbyClient);
	pubsub.subscribe(enums.PubSub.Client_SetGameState, setGameState);
	pubsub.subscribe(enums.PubSub.Client_SetGamePlayerData, setGamePlayerData);
	pubsub.subscribe(enums.PubSub.Client_AddGameWatcher, addGameWatcher);
	pubsub.subscribe(enums.PubSub.Client_RemoveGameWatcher, removeGameWatcher);
	pubsub.subscribe(enums.PubSub.Server_DestroyGame, destroyGame);
	pubsub.subscribe(enums.PubSub.Network_MessageProcessingComplete, messageProcessingComplete);
	pubsub.subscribe(enums.PubSub.Network_Disconnect, reset);
	pubsub.subscribe(enums.PubSub.Client_InitializationComplete, onInitializationComplete);

	return {
		setShowOnGamePage: setShowOnGamePage,
		setPositionForPage: setPositionForPage
	};
});
