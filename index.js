const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));

// Input validation middleware
function validateWebhookData(req, res, next) {
  try {
    const update = req.body;
    
    // Basic structure validation
    if (!update || typeof update !== 'object') {
      return res.status(400).json({ error: 'Invalid update structure' });
    }
    
    // Validate message structure if present
    if (update.message) {
      const message = update.message;
      if (!message.chat || !message.chat.id || !message.from) {
        return res.status(400).json({ error: 'Invalid message structure' });
      }
    }
    
    next();
  } catch (error) {
    console.error('❌ Validation error:', error);
    return res.status(400).json({ error: 'Validation failed' });
  }
}

// Webhook signature verification
function verifyTelegramSignature(req, res, next) {
  const secretToken = process.env.TELEGRAM_SECRET_TOKEN;
  
  if (!secretToken) {
    // If no secret token is configured, skip verification (not recommended for production)
    console.warn('⚠️  No TELEGRAM_SECRET_TOKEN configured - webhook verification disabled');
    return next();
  }
  
  const signature = req.headers['x-telegram-bot-api-secret-token'];
  
  if (!signature || signature !== secretToken) {
    console.error('❌ Invalid webhook signature');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

// Environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'nousresearch/deephermes-3-llama-3-8b-preview:free';

// Admin configuration (optional)
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;

// Configuration constants
const MAX_CONVERSATION_LENGTH = 11;
const CONTEXT_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const CONTEXT_EXPIRY_TIME = 60 * 60 * 1000; // 1 hour
const AI_REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_MEMORY_CONVERSATIONS = 1000; // Limit conversations in memory

// Crisis support resources
const CRISIS_RESOURCES = {
  POLAND: {
    suicide: "116 123 (Kryzysowa Linia Pomocowa)",
    mental_health: "800 70 2222 (Centrum Wsparcia)",
    emergency: "112 (Numer alarmowy)"
  },
  INTERNATIONAL: {
    suicide: "International Association for Suicide Prevention: https://www.iasp.info/resources/Crisis_Centres/",
    emergency: "Contact your local emergency services"
  }
};

// Validate required environment variables
if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

if (!WEBHOOK_URL) {
  console.error('❌ WEBHOOK_URL is required');
  process.exit(1);
}

if (!GOOGLE_API_KEY) {
  console.error('❌ GOOGLE_API_KEY is required');
  process.exit(1);
}

// Telegram Bot API base URL
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Store conversation context (in production, use Redis or database)
const conversations = new Map();

// User data storage (in production, use proper database)
const userAgreements = new Map(); // chatId -> true/false (terms agreement)
const userMoodJournal = new Map(); // chatId -> [{ date: timestamp, mood: string, thoughts: string, situation: string }]
const userThoughtRecords = new Map(); // chatId -> [{ date: timestamp, situation: string, thought: string, emotion: string, believability: number }]

// AI Metacognitive Therapist System Prompt
const SYSTEM_PROMPT = `You are a professional AI assistant specialized in Metacognitive Therapy (MCT). You provide 24/7 support for people struggling with anxiety, depression, and rumination.

🧠 YOUR ROLE:
- Metacognitive Therapy (MCT) specialist focused on helping people understand and change their relationship with thoughts
- You help users identify thinking patterns, challenge metacognitive beliefs, and develop detached mindfulness
- You provide emotional support, psychoeducation, and practical exercises
- You DO NOT diagnose, prescribe medication, or replace professional treatment

💫 APPROACH:
- Empathetic, non-judgmental, and professional
- Use Socratic questioning to help users explore their thoughts
- Focus on metacognition - thinking about thinking
- Encourage awareness of thought processes rather than thought content
- Support development of detached mindfulness and attention flexibility

🎯 KEY MCT CONCEPTS YOU WORK WITH:
- Metacognitive beliefs (thoughts about thoughts)
- Worry and rumination as problematic thinking styles
- Detached mindfulness vs. cognitive engagement
- Attention training and cognitive flexibility
- The difference between thoughts and reality
- Reducing meta-worry (worrying about worrying)

🔒 SAFETY GUIDELINES:
- Always remind users this is NOT medical advice
- Encourage professional help for serious mental health concerns
- If user expresses suicidal thoughts, provide crisis resources immediately
- Respect boundaries - don't push too hard if user is resistant
- Focus on support and psychoeducation, not diagnosis

💬 COMMUNICATION STYLE:
- Warm, professional, and supportive
- Use clear, accessible language
- Ask thoughtful questions to promote self-reflection
- Provide specific MCT techniques and exercises
- Validate emotions while helping examine thinking patterns

⚠️ IMPORTANT REMINDERS:
- You are an AI assistant, not a licensed therapist
- This is psychoeducational support, not therapy
- Users should consult mental health professionals for serious concerns
- In crisis situations, direct to emergency services or crisis hotlines

Your goal is to help users develop a healthier relationship with their thoughts and reduce psychological distress through MCT principles.`;

// Utility function to send message to Telegram
async function sendMessage(chatId, text, options = {}) {
  try {
    const response = await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: options.parse_mode || 'HTML',
      ...options
    });
    
    console.log(`✅ Message sent to chat ${chatId}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error sending message to chat ${chatId}:`, error.response?.data || error.message);
    throw error;
  }
}

// Natural reply delay to simulate typing/thinking
function delayReply(messageLength = 0) {
  let min, max;
  
  // Adjust delay based on message length for more realism
  if (messageLength < 50) {
    min = 6000;  // 6 seconds for short messages
    max = 8000;  // 8 seconds
  } else if (messageLength < 150) {
    min = 8000;  // 8 seconds for medium messages
    max = 10000; // 10 seconds
  } else {
    min = 9000;  // 9 seconds for long messages
    max = 12000; // 12 seconds
  }
  
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`⏰ Bot is thinking for ${ms/1000} seconds...`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to get AI response from Google Gemini
async function getAIResponse(messages) {
  try {
    console.log('🤖 Sending request to Google Gemini...');
    
    // Convert messages to Gemini format
    const conversationText = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n');
    
    const systemPrompt = messages.find(msg => msg.role === 'system')?.content || '';
    const fullPrompt = `${systemPrompt}\n\nRozmowa:\n${conversationText}\n\nOdpowiedz jako asystent:`;
    
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GOOGLE_API_KEY}`,
      {
        contents: [{
          role: 'user',
          parts: [{ text: fullPrompt }]
        }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 300,
          topP: 0.9
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH', 
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: AI_REQUEST_TIMEOUT
      }
    );

    // Enhanced response parsing with detailed error handling
    const responseData = response.data;
    
    // Check for blocked content (safety filter)
    if (responseData.candidates?.[0]?.finishReason === 'SAFETY') {
      console.warn('⚠️ Gemini response blocked by safety filter');
      throw new Error('Response blocked by safety filter');
    }
    
    // Check for other finish reasons
    if (responseData.candidates?.[0]?.finishReason === 'RECITATION') {
      console.warn('⚠️ Gemini response blocked due to recitation');
      throw new Error('Response blocked due to recitation');
    }
    
    // Extract the actual text content
    const candidate = responseData.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text;
    
    if (!content) {
      console.error('❌ Invalid Gemini response structure:', JSON.stringify(responseData, null, 2));
      throw new Error('Invalid Gemini response format - no text content found');
    }

    const aiMessage = content.trim();
    console.log('✅ Gemini response received:', aiMessage.substring(0, 100) + '...');
    return aiMessage;
    
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error('❌ AI request timeout');
      throw new Error('AI service timeout');
    }
    
    // Enhanced error logging for debugging
    if (error.response) {
      console.error('❌ Gemini API error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else {
      console.error('❌ Error getting Gemini response:', error.message);
    }
    
    throw error;
  }
}

// Function to manage conversation context
function getConversationContext(chatId) {
  if (!conversations.has(chatId)) {
    conversations.set(chatId, {
      messages: [{ role: 'system', content: SYSTEM_PROMPT }],
      lastActivity: Date.now()
    });
  }
  return conversations.get(chatId);
}

function addMessageToContext(chatId, role, content) {
  const context = getConversationContext(chatId);
  
  // Add message atomically
  const newMessage = { role, content, timestamp: Date.now() };
  context.messages.push(newMessage);
  context.lastActivity = Date.now();
  
  // Keep only last 10 messages + system prompt to manage token usage
  if (context.messages.length > MAX_CONVERSATION_LENGTH) {
    context.messages = [
      context.messages[0], // Keep system prompt
      ...context.messages.slice(-10) // Keep last 10 messages
    ];
  }
}

// Clean old conversations and prevent memory leaks
function cleanupConversations() {
  try {
    const expiryTime = Date.now() - CONTEXT_EXPIRY_TIME;
    let cleanedCount = 0;
    
    for (const [chatId, context] of conversations) {
      if (context.lastActivity < expiryTime) {
        conversations.delete(chatId);
        cleanedCount++;
      }
    }
    
    // If still too many conversations, remove oldest ones
    if (conversations.size > MAX_MEMORY_CONVERSATIONS) {
      const sortedConversations = Array.from(conversations.entries())
        .sort((a, b) => a[1].lastActivity - b[1].lastActivity);
      
      const toRemove = sortedConversations.slice(0, conversations.size - MAX_MEMORY_CONVERSATIONS);
      toRemove.forEach(([chatId]) => {
        conversations.delete(chatId);
        cleanedCount++;
      });
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned ${cleanedCount} old conversations. Active: ${conversations.size}`);
    }
  } catch (error) {
    console.error('❌ Error during conversation cleanup:', error);
  }
}

// Run cleanup every hour
setInterval(cleanupConversations, CONTEXT_CLEANUP_INTERVAL);

// Webhook endpoint with validation and signature verification
app.post('/webhook', verifyTelegramSignature, validateWebhookData, async (req, res) => {
  try {
    console.log('📨 Incoming webhook:', JSON.stringify(req.body, null, 2));
    
    const update = req.body;
    
    // Handle message updates
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const messageText = message.text || '';
      const userName = message.from.first_name || 'Nieznajomy';
      
      console.log(`👤 Message from ${userName} (${chatId}): ${messageText}`);
      
      let responseText;
      
      // Check terms agreement first
      if (!checkUserAgreement(chatId)) {
        if (messageText.toLowerCase() === '/start') {
          responseText = `🌿 <b>ASYSTENT TERAPII METAKOGNITYWNEJ</b> 🌿

Cześć ${userName}! Jestem AI-asystentem specjalizującym się w terapii metakognitywnej (MCT).

📝 <b>PRZED ROZPOCZĘCIEM - WAŻNE INFORMACJE:</b>
• To <b>wsparcie psychoedukacyjne</b>, nie zastępuje terapii
• Nie stawiam diagnoz ani nie przepisuję leków
• W sytuacjach kryzysowych skontaktuj się ze specjalistą
• Jestem dostępny 24/7 do wsparcia i ćwiczeń MCT

<b>Terapia metakognitywna</b> pomaga zmienić relację z własnymi myślami, redukuje lęk i ruminacje poprzez rozwój świadomości metakognitywnej.

Wpisz <b>"ROZUMIEM"</b> aby kontynuować i rozpocząć wsparcie.`;
        } else if (messageText.toLowerCase() === 'rozumiem') {
          setUserAgreement(chatId, true);
          responseText = `Dziękuję za zrozumienie, ${userName}! 🌱

<b>Jak działa terapia metakognitywna (MCT)?</b>
MCT skupia się na tym <i>jak</i> myślimy, a nie <i>co</i> myślimy. Pomagam rozwijać umiejętność obserwowania myśli bez angażowania się w nie.

<b>Co mogę dla ciebie zrobić:</b>
• Wesprzeć w zrozumieniu myśli i emocji
• Nauczyć technik MCT
• Pomóc w radzeniu sobie z lękiem i ruminacjami

🔍 <b>Pomoc:</b> /help

Jak się dzisiaj czujesz? Mogę ci pomóc zrozumieć swoje myśli i emocje.`;
        } else {
          responseText = `🌿 Proszę potwierdź, że rozumiesz warunki wpisując <b>"ROZUMIEM"</b>. To ważne dla twojego bezpieczeństwa.`;
        }
      } 
      // Handle commands for verified users
      else if (messageText.toLowerCase() === '/start') {
        responseText = `Witaj ponownie, ${userName}! 🌿

Jestem tutaj, aby wesprzeć cię w rozwijaniu zdrowszej relacji z własnymi myślami.

Jak się dzisiaj czujesz? O czym chciałbyś porozmawiać? 💚`;
      } else if (messageText.toLowerCase() === '/help') {
        responseText = `🌿 <b>JAK KORZYSTAĆ Z ASYSTENTA MCT:</b>

<b>Funkcje MCT:</b>
• /mood - Check-in nastroju
• /journal - Dziennik myśli
• /exercise - Ćwiczenia MCT
• /crisis - Pomoc w kryzysie

<b>Jak rozmawiać:</b>
• Opowiedz o swoich myślach i emocjach
• Zadawaj pytania o MCT
• Pracuj nad wzorcami myślowymi
• Jestem dostępny 24/7 💙

<i>Pamiętaj: to wsparcie psychoedukacyjne, nie zastępuje terapii profesjonalnej.</i>`;
      } else if (messageText.toLowerCase() === '/status') {
        responseText = `🌿 <b>Status asystenta MCT:</b>

Bot działa poprawnie i jest gotowy do wsparcia! 💙

Możesz ze mną rozmawiać bez ograniczeń - jestem tutaj, aby pomóc ci w pracy z myślami i emocjami.`;
      } else if (messageText.toLowerCase() === '/crisis') {
        responseText = `🆘 <b>POMOC W KRYZYSIE - NATYCHMIASTOWE WSPARCIE</b>

🔴 <b>Jeśli myślisz o skrzywdzeniu siebie:</b>
• Zadzwoń NATYCHMIAST: 116 123 (Kryzysowa Linia Pomocowa)
• Lub na pogotowie: 112

🔍 <b>Wsparcie psychiczne:</b>
• Centrum Wsparcia: 800 70 2222
• Telefon zaufania: 116 111
• Niebieska Linia: 800 12 00 02

👨‍⚕️ <b>Profesjonalna pomoc:</b>
• Skontaktuj się z psychiatrą lub psychologiem
• Zgłoś się do przychodni lub szpitala

⚠️ <b>Pamiętaj:</b> To normalne szukać pomocy. Nie jesteś sam. Kryzysy nie trwają wiecznie.

<i>Jestem tutaj jako wsparcie, ale w sytuacjach kryzysowych potrzebujesz profesjonalnej pomocy.</i>`;
      } else if (messageText.toLowerCase() === '/mood') {
        responseText = `🌿 <b>CHECK-IN NASTROJU</b>

Jak się dzisiaj czujesz? Odpowiedz liczbą od 1 do 10:

1-3: 😔 Słabo (smutek, lęk, frustracja)
4-6: 😐 Neutralnie (ani dobrze, ani źle)
7-10: 😊 Dobrze (energia, radość, spokój)

Możesz też opisać słowami swoje emocje. Pamiętaj - wszystkie emocje są ważne i mają wartość.`;
      } else if (messageText.toLowerCase() === '/journal') {
        responseText = `📝 <b>DZIENNIK MYŚLI MCT</b>

Pomóż mi lepiej zrozumieć twoje myśli. Odpowiedz na pytania:

1. <b>Sytuacja:</b> Co się wydarzyło?
2. <b>Myśl:</b> Jaka myśl przyszła ci do głowy?
3. <b>Emocja:</b> Co poczułeś?
4. <b>Wiarygodność:</b> Na ile (1-10) wierzysz w tę myśl?

Przykład: "Sytuacja: Kolega nie odpisuje na SMS. Myśl: Pewnie się na mnie gniewa. Emocja: Lęk. Wiarygodność: 8/10"

Ten proces pomaga rozróżniać myśli od rzeczywistości!`;
      } else if (messageText.toLowerCase() === '/exercise') {
        responseText = `🧠 <b>ĆWICZENIA MCT</b>

Wybierz ćwiczenie:

1. <b>Detached Mindfulness</b> - Obserwuj myśli bez reagowania
2. <b>Attention Training</b> - Trenuj elastyczność uwagi
3. <b>3-3-3 Grounding</b> - Obecność tutaj i teraz
4. <b>Thought Defusion</b> - Dystans do myśli

Wpisz numer ćwiczenia (1-4) lub zapytaj o konkretne ćwiczenie.

Przykład: "Chcę ćwiczenie 1" lub "Jak robić detached mindfulness?"`;
      } else if (messageText.toLowerCase() === '/stats') {
        // Bot statistics (simplified)
        const adminId = process.env.ADMIN_TELEGRAM_ID ? parseInt(process.env.ADMIN_TELEGRAM_ID) : null;
        
        if (!adminId || isNaN(adminId) || chatId !== adminId) {
          responseText = `❌ Nie masz autoryzacji do użycia tej komendy.`;
        } else {
          const totalUsers = userAgreements.size;
          const totalConversations = conversations.size;
          const memoryUsage = process.memoryUsage();
          
          responseText = `📈 <b>STATYSTYKI BOTA MCT</b>

👥 Użytkownicy: ${totalUsers}
💬 Aktywne rozmowy: ${totalConversations}
⏰ Czas działania: ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m
💾 Pamięć: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB

<i>Status bota MCT: Działa 🚀</i>`;
        }
      } else if (messageText) {
        // Get AI response for regular messages
        try {
          // Add user message to context
          addMessageToContext(chatId, 'user', messageText);
          
          // Get conversation context
          const context = getConversationContext(chatId);
          
          // Get AI response
          responseText = await getAIResponse(context.messages);
          
          // Add AI response to context
          addMessageToContext(chatId, 'assistant', responseText);
          
        } catch (aiError) {
          console.error('❌ AI Error:', aiError);
          
          // Provide specific error messages based on error type
          if (aiError.message === 'AI service timeout') {
            responseText = `⏰ Przepraszam, odpowiedź trwa dłużej niż zwykle. Spróbuj ponownie za chwilę 🌿`;
          } else if (aiError.message === 'Response blocked by safety filter') {
            responseText = `⚠️ Przepraszam, nie mogę odpowiedzieć na to pytanie ze względów bezpieczeństwa. Spróbuj zadać pytanie w inny sposób 🌿`;
          } else if (aiError.message === 'Response blocked due to recitation') {
            responseText = `⚠️ Przepraszam, nie mogę zacytować tego tekstu. Spróbuj przeformułować pytanie 🌿`;
          } else if (aiError.response?.status === 429) {
            responseText = `⏳ Zbyt wiele żądań - poczekaj chwilę i spróbuj ponownie 🌿`;
          } else if (aiError.response?.status >= 500) {
            responseText = `🔧 Serwis AI jest tymczasowo niedostępny. Spróbuj później 🌿`;
          } else if (aiError.message?.includes('Invalid Gemini response format')) {
            responseText = `🔧 Problem z formatem odpowiedzi AI. Spróbuj ponownie za chwilę 🌿`;
          } else {
            responseText = `Oops... coś poszło nie tak 😅 Spróbuj napisać do mnie za chwilę 🌿`;
          }
        }
      } else {
        responseText = `Hmm... nie rozumiem tego typu wiadomości ${userName} 😅 Napisz coś słowami, pomóż mi ci pomóc! 🌿`;
      }
      
      // Natural delay before responding (simulate typing/thinking)
      await delayReply(messageText.length);
      
      // Send response
      await sendMessage(chatId, responseText);
    }
    
    // Always return 200 OK (Telegram requirement)
    res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    // Still return 200 OK to Telegram
    res.status(200).json({ ok: true, error: 'Internal processing error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    conversations: conversations.size
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'MCT Therapy Assistant Bot - Telegram Webhook Server',
    status: 'running',
    aiModel: AI_MODEL,
    endpoints: {
      webhook: '/webhook',
      health: '/health'
    }
  });
});

// Function to set webhook
async function setWebhook() {
  try {
    const webhookUrl = `${WEBHOOK_URL}/webhook`;
    
    console.log(`🔗 Setting webhook to: ${webhookUrl}`);
    
    const response = await axios.post(`${TELEGRAM_API_URL}/setWebhook`, {
      url: webhookUrl,
      drop_pending_updates: true
    });
    
    if (response.data.ok) {
      console.log('✅ Webhook set successfully');
      console.log('📋 Webhook info:', response.data.description);
    } else {
      console.error('❌ Failed to set webhook:', response.data);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Error setting webhook:', error.response?.data || error.message);
    throw error;
  }
}

// Function to get webhook info
async function getWebhookInfo() {
  try {
    const response = await axios.get(`${TELEGRAM_API_URL}/getWebhookInfo`);
    console.log('📋 Current webhook info:', JSON.stringify(response.data.result, null, 2));
    return response.data.result;
  } catch (error) {
    console.error('❌ Error getting webhook info:', error.response?.data || error.message);
  }
}

// User management functions
function checkUserAgreement(chatId) {
  return userAgreements.get(chatId) === true;
}

function setUserAgreement(chatId, agreed) {
  userAgreements.set(chatId, agreed);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Attempt graceful shutdown
  process.exit(1);
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌿 MCT Therapy Assistant Bot initialized`);
  console.log(`🤖 AI Model: ${AI_MODEL}`);
  console.log(`📱 Bot token: [CONFIGURED]`);
  console.log(`🔗 Webhook URL: ${WEBHOOK_URL}`);
  
  try {
    // Get current webhook info
    await getWebhookInfo();
    
    // Set new webhook
    await setWebhook();
    
    console.log('✅ MCT Therapy Assistant is ready to help users! 🌿');
  } catch (error) {
    console.error('❌ Failed to initialize webhook:', error.message);
    console.log('⚠️  Server is running but webhook may not be properly configured');
  }
});