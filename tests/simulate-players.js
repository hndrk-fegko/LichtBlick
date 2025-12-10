/**
 * Player Simulation Script
 * 
 * Simuliert mehrere Spieler, die sich wie echte Nutzer verhalten:
 * - Verbinden via Socket.IO
 * - Reagieren zustandsabhängig auf Game-Events
 * - Führen nur erlaubte Aktionen aus (je nach Game-Phase)
 * - Simulieren DAU-Verhalten (Delays, falsche Antworten, etc.)
 */

const io = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'https://lichtblick.feg-koblenz.de';
const NUM_PLAYERS = parseInt(process.env.NUM_PLAYERS) || 10;
const ANSWER_DELAY_MIN = parseInt(process.env.ANSWER_DELAY_MIN) || 500;
const ANSWER_DELAY_MAX = parseInt(process.env.ANSWER_DELAY_MAX) || 3000;
const CORRECT_ANSWER_CHANCE = parseFloat(process.env.CORRECT_ANSWER_CHANCE) || 0.3; // 30% richtig

// Zufällige Namen für Spieler
const NAMES = [
  'Anna', 'Ben', 'Clara', 'David', 'Emma', 'Felix', 'Greta', 'Hannah',
  'Ida', 'Jonas', 'Klara', 'Leon', 'Mia', 'Noah', 'Olivia', 'Paul',
  'Quinn', 'Rosa', 'Sam', 'Tina', 'Udo', 'Vera', 'Willi', 'Xena',
  'Yara', 'Zoe', 'Max', 'Lena', 'Tim', 'Sophie'
];

// Mögliche Antworten (für falsche Antworten)
const POSSIBLE_ANSWERS = [
  'Freude', 'Trauer', 'Wut', 'Angst', 'Überraschung', 
  'Ekel', 'Stolz', 'Scham', 'Neid', 'Liebe',
  'Hass', 'Mut', 'Langeweile', 'Aufregung', 'Ruhe',
  'Stress', 'Glück', 'Enttäuschung', 'Hoffnung', 'Verzweiflung'
];

/**
 * Simuliert einen einzelnen Spieler mit zustandsbasiertem Verhalten
 */
class PlayerSimulator {
  constructor(name, index) {
    this.name = name;
    this.index = index;
    this.socket = null;
    this.gameId = null;
    this.playerId = null;
    this.connected = false;
    this.hasJoined = false; // Verhindert doppeltes Beitreten
    
    // Game State (simuliert Client-State wie in player.js)
    this.phase = 'login'; // login, lobby, playing, ended
    this.currentImageId = null;
    this.currentWordList = [];
    this.lockedWord = null;
    this.score = 0;
    this.correctAnswer = null; // Wird bei image:revealed gespeichert
  }

  /**
   * Verbindung zum Server herstellen
   */
  connect() {
    console.log(`[${this.name}] 🔌 Verbinde mit ${SERVER_URL}...`);
    
    this.socket = io(SERVER_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.setupEventHandlers();
  }

  /**
   * Event Handler registrieren (wie in player.js)
   */
  setupEventHandlers() {
    // Connection Events
    this.socket.on('connect', () => {
      this.connected = true;
      console.log(`✅ [${this.name}] Verbunden: ${this.socket.id}`);
      
      // Nach kurzer Verzögerung beitreten (simuliert echtes Nutzerverhalten)
      setTimeout(() => {
        this.performAction('join');
      }, Math.random() * 3000 + 500);
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.log(`❌ [${this.name}] Getrennt: ${reason}`);
    });

    this.socket.on('connect_error', (error) => {
      console.error(`⚠️ [${this.name}] Verbindungsfehler:`, error.message);
    });

    // Game Events
    this.socket.on('game:created', (data) => {
      console.log(`🎮 [${this.name}] Neues Spiel erstellt: ${data.gameId}`);
      this.gameId = data.gameId;
    });

    this.socket.on('player:joined', (data) => {
      if (data.name === this.name) {
        console.log(`👋 [${this.name}] Erfolgreich beigetreten als Spieler ${data.playerId}`);
        this.playerId = data.playerId;
        this.phase = 'lobby';
        this.hasJoined = true; // Markiere als beigetreten
      }
    });

    this.socket.on('game:lobby_update', (data) => {
      if (this.phase === 'lobby') {
        console.log(`📊 [${this.name}] Lobby Update: ${data.players?.length || 0} Spieler`);
      }
    });

    this.socket.on('game:phase_change', (data) => {
      console.log(`🔄 [${this.name}] Phase-Wechsel: ${this.phase} → ${data.phase}`);
      this.phase = data.phase;
      
      if (data.phase === 'playing') {
        this.currentImageId = data.imageId;
        this.currentWordList = data.wordList || [];
        this.lockedWord = null;
        console.log(`🎯 [${this.name}] Spiel gestartet! ${this.currentWordList.length} Wörter verfügbar`);
        
        // Wähle und locke zufälliges Wort nach kurzer Verzögerung
        this.scheduleWordSelection();
      }
    });

    this.socket.on('game:image_revealed', (data) => {
      if (this.phase !== 'playing') {
        console.warn(`⚠️ [${this.name}] image_revealed in falscher Phase: ${this.phase}`);
        return;
      }
      
      this.correctAnswer = data.correctAnswer;
      const isCorrect = this.lockedWord?.toLowerCase() === data.correctAnswer.toLowerCase();
      
      console.log(`🖼️ [${this.name}] Bild enthüllt: "${data.correctAnswer}"`);
      console.log(`   Meine Antwort: "${this.lockedWord || 'KEINE'}" ${isCorrect ? '✅' : '❌'}`);
      
      // Reset für nächstes Bild
      this.lockedWord = null;
      this.correctAnswer = null;
    });

    this.socket.on('game:leaderboard_update', (data) => {
      const myData = data.players?.find(p => p.id === this.playerId);
      if (myData) {
        this.score = myData.score;
        const rank = data.players.findIndex(p => p.id === this.playerId) + 1;
        console.log(`📊 [${this.name}] Leaderboard: Rang ${rank}/${data.players.length} - ${this.score} Punkte`);
      }
    });

    this.socket.on('game:ended', (data) => {
      console.log(`🏁 [${this.name}] Spiel beendet!`);
      this.phase = 'ended';
      
      const myRank = data.finalRanking?.findIndex(p => p.id === this.playerId) + 1;
      if (myRank > 0) {
        const myData = data.finalRanking.find(p => p.id === this.playerId);
        console.log(`🏆 [${this.name}] Endplatzierung: Rang ${myRank} mit ${myData.score} Punkten`);
      }
    });

    this.socket.on('player:lock_answer', (data) => {
      if (data.playerId === this.playerId) {
        console.log(`🔒 [${this.name}] Antwort gelockt: "${data.word}"`);
      }
    });

    this.socket.on('player:game_reset', () => {
      console.log(`🔄 [${this.name}] Spiel wurde zurückgesetzt`);
      this.phase = 'lobby';
      this.currentImageId = null;
      this.lockedWord = null;
      this.score = 0;
      this.hasJoined = false; // Erlaubt erneutes Beitreten
    });

    this.socket.on('error', (data) => {
      console.error(`❌ [${this.name}] Fehler: ${data.message}`);
    });
  }

  /**
   * Zustandsabhängige Aktionen ausführen
   */
  performAction(action) {
    switch (action) {
      case 'join':
        if (this.phase === 'login' && this.connected && !this.hasJoined) {
          this.joinGame();
        }
        break;
      
      case 'selectWord':
        if (this.phase === 'playing' && !this.lockedWord && this.currentImageId) {
          this.selectAndLockWord();
        }
        break;
      
      default:
        console.warn(`⚠️ [${this.name}] Unbekannte Aktion: ${action}`);
    }
  }

  /**
   * Tritt dem Spiel bei (nur in 'login' Phase erlaubt)
   */
  joinGame() {
    console.log(`👤 [${this.name}] Trete Spiel bei...`);
    this.socket.emit('player:join', { name: this.name }, (response) => {
      if (response?.success) {
        this.playerId = response.data.playerId;
        console.log(`✓ [${this.name}] Beigetreten als ID ${this.playerId}`);
      } else {
        console.error(`✗ [${this.name}] Join failed: ${response?.message || 'Unknown error'}`);
      }
    });
  }

  /**
   * Plant Wort-Auswahl nach zufälliger Verzögerung
   */
  scheduleWordSelection() {
    const delay = Math.random() * (ANSWER_DELAY_MAX - ANSWER_DELAY_MIN) + ANSWER_DELAY_MIN;
    
    setTimeout(() => {
      this.performAction('selectWord');
    }, delay);
  }

  /**
   * Wählt und lockt ein Wort (nur in 'playing' Phase erlaubt)
   */
  selectAndLockWord() {
    if (!this.currentWordList || this.currentWordList.length === 0) {
      console.warn(`⚠️ [${this.name}] Keine Wörter verfügbar`);
      return;
    }

    // Entscheide: Richtige oder falsche Antwort?
    let word;
    const shouldBeCorrect = Math.random() < CORRECT_ANSWER_CHANCE;
    
    if (shouldBeCorrect && this.correctAnswer && this.currentWordList.includes(this.correctAnswer)) {
      // Wähle richtige Antwort (falls bekannt und in Liste)
      word = this.correctAnswer;
    } else {
      // Wähle zufälliges Wort aus Liste
      word = this.currentWordList[Math.floor(Math.random() * this.currentWordList.length)];
    }

    console.log(`💭 [${this.name}] Wähle Wort: "${word}"`);
    
    // Lock Answer via Socket
    this.socket.emit('player:lock_answer', {
      gameId: this.gameId,
      imageId: this.currentImageId,
      word: word
    });
    
    this.lockedWord = word;
  }

  /**
   * Verbindung trennen
   */
  disconnect() {
    if (this.socket) {
      console.log(`👋 [${this.name}] Trenne Verbindung...`);
      this.socket.disconnect();
    }
  }
}


// ============================================================
// HAUPTPROGRAMM
// ============================================================

async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🎮 LichtBlick Spieler-Simulator (Zustandsbasiert)');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Server:             ${SERVER_URL}`);
  console.log(`Anzahl Spieler:     ${NUM_PLAYERS}`);
  console.log(`Antwort-Delay:      ${ANSWER_DELAY_MIN}-${ANSWER_DELAY_MAX}ms`);
  console.log(`Richtig-Chance:     ${(CORRECT_ANSWER_CHANCE * 100).toFixed(0)}%`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Spieler erstellen
  const players = [];
  for (let i = 0; i < NUM_PLAYERS; i++) {
    const name = NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : '');
    const player = new PlayerSimulator(name, i);
    players.push(player);
  }

  // Spieler nacheinander verbinden (realistischer)
  console.log('🔌 Verbinde Spieler...\n');
  for (let i = 0; i < players.length; i++) {
    players[i].connect();
    // Kurze Verzögerung zwischen Verbindungen
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Graceful Shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Beende Simulation...');
    players.forEach(p => p.disconnect());
    setTimeout(() => process.exit(0), 1000);
  });

  console.log('\n✅ Alle Spieler verbinden sich und warten auf Game-Events...');
  console.log('💡 Spieler reagieren automatisch auf Phase-Wechsel');
  console.log('💡 Drücke Ctrl+C zum Beenden\n');
  
  // Zeige Statistik alle 10 Sekunden
  setInterval(() => {
    const connected = players.filter(p => p.connected).length;
    const inLobby = players.filter(p => p.phase === 'lobby').length;
    const playing = players.filter(p => p.phase === 'playing').length;
    const ended = players.filter(p => p.phase === 'ended').length;
    
    console.log(`\n📊 Status: ${connected}/${NUM_PLAYERS} verbunden | Lobby: ${inLobby} | Spielen: ${playing} | Beendet: ${ended}`);
  }, 10000);
}

// Starte Hauptprogramm
main().catch(console.error);
