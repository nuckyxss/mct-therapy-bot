const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

// Express server setup
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("OK"));

// Start Express server
app.listen(PORT, () => {
  console.log(`🌐 Express server running on port ${PORT}`);
});

// Konfiguracja z ENV
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'anthropic/claude-3-haiku';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS) || 1024;
const AI_TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE) || 0.7;
const AI_TIMEOUT = parseInt(process.env.AI_TIMEOUT) || 30000;

// Walidacja wymaganych zmiennych środowiskowych
if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ Brak TELEGRAM_BOT_TOKEN w ENV');
  process.exit(1);
}

if (!OPENROUTER_API_KEY) {
  console.error('❌ Brak OPENROUTER_API_KEY w ENV');
  process.exit(1);
}

// Inicjalizacja bota (polling)
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// System prompt - terapeuta metakognitywny
const SYSTEM_PROMPT = `Jesteś profesjonalnym asystentem AI specjalizującym się w terapii metakognitywnej (MCT). Pomagasz ludziom 24/7 w radzeniu sobie z lękiem, depresją i ruminacjami.

🧠 TWOJA ROLA:
- Specjalista terapii metakognitywnej (MCT) skupiający się na zmianie relacji z własnymi myślami
- Pomagasz użytkownikom identyfikować wzorce myślowe, kwestionować przekonania metakognitywne
- Rozwijasz umiejętność zdystansowanej uważności (detached mindfulness)
- Dajesz wsparcie emocjonalne, psychoedukację i praktyczne ćwiczenia
- NIE stawiasz diagnoz, nie przepisujesz leków, nie zastępujesz terapii profesjonalnej

💫 PODEJŚCIE:
- Empatyczny, nie oceniający, profesjonalny
- Używaj pytań sokratycznych aby pomóc w eksploracji myśli
- Skup się na metapoznaniu - myśleniu o myśleniu
- Zachęcaj do świadomości procesów myślowych, nie treści myśli
- Wspieraj rozwój zdystansowanej uważności i elastyczności uwagi

🎯 KLUCZOWE KONCEPCJE MCT:
- Przekonania metakognitywne (myśli o myślach)
- Martwienie się i ruminacje jako problematyczne style myślenia
- Zdystansowana uważność vs. zaangażowanie kognitywne
- Trening uwagi i elastyczność kognitywna
- Różnica między myślami a rzeczywistością
- Redukcja meta-martwieniem się (martwienie się o martwienie)

🔒 ZASADY BEZPIECZEŃSTWA:
- Zawsze przypominaj, że to NIE jest porada medyczna
- Zachęcaj do szukania pomocy profesjonalnej przy poważnych problemach
- Przy myślach samobójczych natychmiast podaj zasoby kryzysowe
- Szanuj granice - nie naciskaj jeśli użytkownik jest opornny
- Skup się na wsparciu i psychoedukacji, nie na diagnozie

💬 STYL KOMUNIKACJI:
- Ciepły, profesjonalny, wspierający
- Używaj jasnego, przystępnego języka
- Zadawaj przemyślane pytania wspierające autorefleksję
- Podawaj konkretne techniki i ćwiczenia MCT
- Waliduj emocje pomagając jednocześnie badać wzorce myślowe

⚠️ WAŻNE PRZYPOMNIENIA:
- Jesteś asystentem AI, nie licencjonowanym terapeutą
- To wsparcie psychoedukacyjne, nie terapia
- Użytkownicy powinni skonsultować się ze specjalistą przy poważnych problemach
- W sytuacjach kryzysowych kieruj do służb ratunkowych lub linii wsparcia

Twoim celem jest pomoc użytkownikom w rozwijaniu zdrowszej relacji z własnymi myślami i redukcji dystresu psychologicznego poprzez zasady MCT.

Odpowiadaj w języku polskim, spokojnie, empatycznie, z troską o dobrostan użytkownika.`;

// Przechowywanie kontekstu rozmów (w produkcji użyj Redis/bazy danych)
const conversations = new Map();

// Funkcja do zapytań AI przez OpenRouter
async function getAIResponse(chatId, userMessage) {
  try {
    console.log(`🤖 Wysyłam zapytanie do OpenRouter (model: ${AI_MODEL})...`);
    
    // Pobierz lub utwórz kontekst rozmowy
    let context = conversations.get(chatId);
    if (!context) {
      context = [
        { role: 'system', content: SYSTEM_PROMPT }
      ];
      conversations.set(chatId, context);
    }
    
    // Dodaj wiadomość użytkownika
    context.push({ role: 'user', content: userMessage });
    
    // Ogranicz historię do ostatnich 20 wiadomości + system prompt
    if (context.length > 21) {
      context = [
        context[0], // zachowaj system prompt
        ...context.slice(-20) // ostatnie 20 wiadomości
      ];
      conversations.set(chatId, context);
    }
    
    const requestBody = {
      model: AI_MODEL,
      messages: context,
      max_tokens: MAX_TOKENS,
      temperature: AI_TEMPERATURE
    };
    
    console.log(`📤 Zapytanie: ${userMessage.substring(0, 100)}...`);
    
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: AI_TIMEOUT
      }
    );
    
    // Uniwersalne parsowanie odpowiedzi OpenRouter
    const aiResponse = response.data?.choices?.[0]?.message?.content;
    
    if (!aiResponse || typeof aiResponse !== 'string' || aiResponse.trim() === '') {
      console.error('❌ Pusta odpowiedź z OpenRouter:', JSON.stringify(response.data, null, 2));
      throw new Error('Pusta odpowiedź z AI');
    }
    
    // Dodaj odpowiedź AI do kontekstu
    context.push({ role: 'assistant', content: aiResponse });
    conversations.set(chatId, context);
    
    console.log(`✅ Odpowiedź AI otrzymana (${aiResponse.length} znaków)`);
    console.log(`📝 Pierwsze 150 znaków: ${aiResponse.substring(0, 150)}...`);
    
    return aiResponse;
    
  } catch (error) {
    console.error('❌ Błąd zapytania AI:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    // Fallback dla różnych typów błędów
    if (error.code === 'ECONNABORTED') {
      return 'Przepraszam, zapytanie do AI przekroczyło limit czasu. Spróbuj ponownie za chwilę.';
    } else if (error.response?.status === 429) {
      return 'Zbyt wiele zapytań. Poczekaj chwilę i spróbuj ponownie.';
    } else if (error.response?.status === 401) {
      return 'Problem z autoryzacją API. Skontaktuj się z administratorem.';
    } else if (error.response?.status >= 500) {
      return 'Serwis AI jest tymczasowo niedostępny. Spróbuj ponownie za kilka minut.';
    } else {
      return 'Wystąpił problem z AI. Spróbuj przeformułować pytanie lub spróbuj ponownie za chwilę.';
    }
  }
}

// Funkcja do czyszczenia starych rozmów (zapobieganie wyciekom pamięci)
function cleanupOldConversations() {
  const MAX_CONVERSATIONS = 1000;
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 godzina
  
  if (conversations.size > MAX_CONVERSATIONS) {
    // Usuń najstarsze rozmowy (prosta implementacja)
    const entries = Array.from(conversations.entries()).slice(0, conversations.size - MAX_CONVERSATIONS);
    entries.forEach(([chatId]) => conversations.delete(chatId));
    console.log(`🧹 Wyczyszczono ${entries.length} starych rozmów`);
  }
}

// Uruchom cleanup co godzinę
setInterval(cleanupOldConversations, 60 * 60 * 1000);

// Obsługa wiadomości tekstowych
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userMessage = msg.text;
  const userName = msg.from.first_name || 'Użytkowniku';
  
  // Ignoruj wiadomości bez tekstu
  if (!userMessage) {
    return;
  }
  
  console.log(`👤 ${userName} (${chatId}): ${userMessage}`);
  
  try {
    // Komenda /start
    if (userMessage === '/start') {
      const welcomeMessage = `🌿 Witaj ${userName}!

Jestem AI-asystentem specjalizującym się w terapii metakognitywnej (MCT).

⚠️ WAŻNE: 
• To wsparcie psychoedukacyjne, nie zastępuje terapii profesjonalnej
• Nie stawiam diagnoz ani nie przepisuję leków
• W sytuacjach kryzysowych skontaktuj się ze specjalistą

🧠 Pomagam w:
• Zrozumieniu wzorców myślowych
• Radzeniu sobie z lękiem i ruminacjami
• Rozwijaniu zdystansowanej uważności
• Technikach terapii metakognitywnej

Jak się dzisiaj czujesz? O czym chciałbyś porozmawiać?`;
      
      await bot.sendMessage(chatId, welcomeMessage);
      return;
    }
    
    // Komenda /help
    if (userMessage === '/help') {
      const helpMessage = `🌿 POMOC - Asystent MCT

🤖 Jak korzystać:
• Opowiedz o swoich myślach i emocjach
• Zadawaj pytania o techniki MCT
• Pracuj nad wzorcami myślowymi
• Jestem dostępny 24/7

📞 W sytuacjach kryzysowych:
• Telefon zaufania: 116 123
• Pogotowie: 112
• Centrum Wsparcia: 800 70 2222

💡 Przykłady pytań:
• "Ciągle się martwię o..."
• "Jak radzić sobie z ruminacjami?"
• "Czuję lęk gdy myślę o..."

Pamiętaj: to wsparcie psychoedukacyjne, nie terapia!`;
      
      await bot.sendMessage(chatId, helpMessage);
      return;
    }
    
    // Regularne wiadomości - przekaż do AI
    await bot.sendChatAction(chatId, 'typing');
    
    const aiResponse = await getAIResponse(chatId, userMessage);
    await bot.sendMessage(chatId, aiResponse);
    
  } catch (error) {
    console.error('❌ Błąd obsługi wiadomości:', error);
    await bot.sendMessage(chatId, 'Przepraszam, wystąpił błąd. Spróbuj ponownie za chwilę.');
  }
});

// Obsługa błędów polling
bot.on('polling_error', (error) => {
  console.error('❌ Błąd polling:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Zamykanie bota...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Zamykanie bota...');
  bot.stopPolling();
  process.exit(0);
});

// Uruchomienie bota
console.log('🚀 Uruchamianie bota terapeuty MCT...');
console.log(`🤖 Model AI: ${AI_MODEL}`);
console.log(`🔧 Max tokens: ${MAX_TOKENS}`);
console.log(`🌡️ Temperature: ${AI_TEMPERATURE}`);
console.log('✅ Bot działa i słucha wiadomości!');