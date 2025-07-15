# 🤖 **INSTRUKCJA KONFIGURACJI TELEGRAM BOTA**

## 📋 **KROK PO KROKU - TELEGRAM BOTFATHER**

### **1. TWORZENIE BOTA**

1. **Otwórz Telegram** i znajdź **@BotFather**
2. **Napisz:** `/start`
3. **Napisz:** `/newbot`
4. **Podaj nazwę bota:** `MCT Therapy Assistant` (lub dowolną)
5. **Podaj username bota:** `mct_therapy_bot` (musi kończyć się na `_bot`)
6. **Skopiuj token** - będzie wyglądał tak: `1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ`

### **2. KONFIGURACJA BOTA**

#### **Ustaw opis bota:**
```
/setdescription
@twoj_bot_username
🌿 Asystent Terapii Metakognitywnej (MCT) - darmowe wsparcie 24/7 w pracy z myślami, lękiem i ruminacjami. Nie zastępuje terapii profesjonalnej.
```

#### **Ustaw krótki opis:**
```
/setabouttext
@twoj_bot_username
🧠 Darmowy asystent MCT - pomoc w pracy z myślami i emocjami 24/7
```

#### **Ustaw komendy bota:**
```
/setcommands
@twoj_bot_username
```

Następnie wklej te komendy:
```
start - Rozpocznij rozmowę z asystentem MCT
help - Lista dostępnych funkcji
status - Status bota
mood - Check-in nastroju
journal - Dziennik myśli MCT
exercise - Ćwiczenia terapeutyczne
crisis - Pomoc w sytuacjach kryzysowych
```

#### **Ustaw zdjęcie profilowe (opcjonalne):**
```
/setuserpic
@twoj_bot_username
```
Następnie wyślij zdjęcie (może być logo MCT lub coś związanego z terapią)

---

## 🚀 **DEPLOYMENT NA HOSTING**

### **OPCJA 1: RAILWAY (ZALECANE)**

1. **Zarejestruj się na:** https://railway.app
2. **Połącz z GitHub** i wybierz swoje repozytorium
3. **Ustaw zmienne środowiskowe:**
   ```
   TELEGRAM_BOT_TOKEN=twoj_token_od_botfather
   WEBHOOK_URL=https://twoja-aplikacja.up.railway.app
   OPENROUTER_API_KEY=twoj_klucz_openrouter
   ADMIN_TELEGRAM_ID=twoj_telegram_id
   ```
4. **Deploy automatycznie się uruchomi**
5. **Skopiuj URL aplikacji** z Railway dashboard

### **OPCJA 2: RENDER**

1. **Zarejestruj się na:** https://render.com
2. **Utwórz nowy Web Service** z GitHub repo
3. **Ustaw zmienne środowiskowe** w Settings
4. **Deploy automatycznie się uruchomi**

### **OPCJA 3: HEROKU**

1. **Zarejestruj się na:** https://heroku.com
2. **Utwórz nową aplikację**
3. **Połącz z GitHub** lub użyj Heroku CLI
4. **Ustaw zmienne środowiskowe** w Settings > Config Vars
5. **Deploy aplikację**

---

## 🔧 **KONFIGURACJA ZMIENNYCH ŚRODOWISKOWYCH**

### **WYMAGANE:**
- `TELEGRAM_BOT_TOKEN` - Token od @BotFather
- `WEBHOOK_URL` - URL twojej aplikacji (np. https://twoja-app.railway.app)
- `OPENROUTER_API_KEY` - Klucz API z OpenRouter.ai

### **OPCJONALNE:**
- `ADMIN_TELEGRAM_ID` - Twój Telegram ID (do komend admina)
- `AI_MODEL` - Model AI (domyślnie: anthropic/claude-3-haiku)

---

## 🔑 **JAK UZYSKAĆ OPENROUTER API KEY**

1. **Idź na:** https://openrouter.ai
2. **Zarejestruj się** lub zaloguj
3. **Idź do:** Account > API Keys
4. **Utwórz nowy klucz API**
5. **Skopiuj klucz** - zaczyna się od `sk-or-...`
6. **Dodaj środki** na konto (minimum $5-10 wystarczy na długo)

---

## 📱 **JAK UZYSKAĆ SWÓJ TELEGRAM ID**

### **METODA 1: Przez @userinfobot**
1. Znajdź **@userinfobot** na Telegramie
2. Napisz `/start`
3. Skopiuj swój **User ID**

### **METODA 2: Przez logi bota**
1. Uruchom bota
2. Napisz do niego `/start`
3. Sprawdź logi serwera - znajdziesz swój ID w logach

---

## ✅ **TESTOWANIE BOTA**

### **1. PODSTAWOWY TEST:**
```
Ty: /start
Bot: Powitanie i prośba o potwierdzenie warunków
Ty: ROZUMIEM
Bot: Informacje o MCT i gotowość do rozmowy
```

### **2. TEST FUNKCJI:**
```
/help - Lista komend
/mood - Check-in nastroju
/journal - Dziennik myśli
/exercise - Ćwiczenia MCT
/crisis - Numery alarmowe
```

### **3. TEST ROZMOWY:**
```
Ty: Czuję się dziś bardzo niespokojny
Bot: Odpowiedź z technikami MCT i pytaniami terapeutycznymi
```

---

## 🛠 **ROZWIĄZYWANIE PROBLEMÓW**

### **BOT NIE ODPOWIADA:**
- Sprawdź czy token jest poprawny
- Zweryfikuj URL webhook
- Sprawdź logi aplikacji na hostingu

### **BŁĘDY AI:**
- Sprawdź klucz OpenRouter API
- Zweryfikuj saldo na koncie OpenRouter
- Sprawdź czy model AI jest dostępny

### **WEBHOOK ERRORS:**
- URL musi być HTTPS
- Sprawdź czy aplikacja działa (endpoint /health)
- Zweryfikuj konfigurację hostingu

---

## 📊 **MONITORING I STATYSTYKI**

### **KOMENDY ADMINA:**
- `/stats` - Statystyki bota (tylko dla admina)

### **ENDPOINTY MONITORINGU:**
- `https://twoja-app.com/health` - Status aplikacji
- `https://twoja-app.com/` - Informacje o bocie

---

## 🎯 **GOTOWE!**

Po wykonaniu wszystkich kroków twój bot MCT będzie:
- ✅ **Działać 24/7** na wybranym hostingu
- ✅ **Odpowiadać użytkownikom** bez ograniczeń
- ✅ **Pomagać w terapii MCT** za darmo
- ✅ **Być gotowy do skalowania** w przyszłości

**Bot jest teraz gotowy do pomocy ludziom z problemami psychicznymi! 🌿**

---

## 💡 **DODATKOWE WSKAZÓWKI**

### **BEZPIECZEŃSTWO:**
- Nie udostępniaj tokenów publicznie
- Używaj zmiennych środowiskowych
- Regularnie sprawdzaj logi

### **OPTYMALIZACJA:**
- Monitoruj użycie API OpenRouter
- Dostosuj model AI do potrzeb
- Rozważ dodanie bazy danych dla większego ruchu

### **WSPARCIE:**
- Sprawdzaj logi regularnie
- Testuj nowe funkcje przed wdrożeniem
- Zbieraj feedback od użytkowników