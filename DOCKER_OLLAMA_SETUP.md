# Docker + Ollama Setup Guide
## Government Analytics Dashboard - Local AI in Docker

---

## 🐳 **Docker Environment Issue**

When your backend runs in Docker, it can't access services on your host machine's `localhost`. This is why you're seeing:

```
❌ Error Loading Models
Could not connect to the local AI service.
```

Here are **3 solutions** to fix this:

---

## 🔧 **Solution 1: Use Host Network (Simplest)**

### **For Development:**
```bash
# If using docker run
docker run --network host your-backend-image

# If using docker-compose, add to your backend service:
```

```yaml
services:
  backend:
    build: ./server
    network_mode: host  # Add this line
    environment:
      - OLLAMA_URL=http://localhost:11434
```

### **Environment Variables:**
```bash
# In your .env file
OLLAMA_URL=http://localhost:11434
DOCKER_ENV=false
```

---

## 🔧 **Solution 2: Use Docker Bridge Network**

### **For Windows/Mac Docker Desktop:**
```yaml
services:
  backend:
    build: ./server
    ports:
      - "3000:3000"
    environment:
      - OLLAMA_URL=http://host.docker.internal:11434
      - DOCKER_ENV=true
```

### **For Linux Docker:**
```yaml
services:
  backend:
    build: ./server
    ports:
      - "3000:3000"
    environment:
      - OLLAMA_URL=http://172.17.0.1:11434
      - DOCKER_ENV=true
```

### **Environment Variables:**
```bash
# Windows/Mac
OLLAMA_URL=http://host.docker.internal:11434

# Linux
OLLAMA_URL=http://172.17.0.1:11434
```

---

## 🔧 **Solution 3: Run Everything in Docker (Recommended)**

### **Use the Complete Docker Compose:**
```bash
# Use the provided docker-compose file
docker-compose -f docker-compose.ollama.yml up -d
```

This includes:
- ✅ **Ollama Service** - Runs AI models in Docker
- ✅ **Backend Service** - Your analytics dashboard
- ✅ **MongoDB** - Database
- ✅ **Redis** - Cache
- ✅ **Proper Networking** - All services can communicate

### **Complete docker-compose.ollama.yml:**
```yaml
version: '3.8'

services:
  # Ollama AI Service (NEW!)
  ollama:
    image: ollama/ollama:latest
    container_name: analytics-ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_ORIGINS=*

  # Your Backend
  backend:
    build: ./server
    container_name: analytics-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    depends_on:
      - ollama
    environment:
      - OLLAMA_URL=http://ollama:11434  # Uses Docker service name
      - DOCKER_ENV=true
      - LOCAL_AI_ENABLED=true

volumes:
  ollama_data:
```

---

## 🚀 **Quick Fix Commands**

### **Option A: Set Environment Variable (Easiest)**
```bash
# Windows/Mac
export OLLAMA_URL=http://host.docker.internal:11434

# Linux  
export OLLAMA_URL=http://172.17.0.1:11434

# Then restart your backend
docker-compose restart backend
```

### **Option B: Update Docker Compose**
Add this to your backend service:
```yaml
services:
  backend:
    # ... existing config
    environment:
      - OLLAMA_URL=http://host.docker.internal:11434  # Windows/Mac
      # - OLLAMA_URL=http://172.17.0.1:11434         # Linux
      - DOCKER_ENV=true
```

### **Option C: Use Complete Docker Setup**
```bash
# Stop current containers
docker-compose down

# Use the new Docker Compose with Ollama
docker-compose -f docker-compose.ollama.yml up -d

# Install models in the Ollama container
docker exec -it analytics-ollama ollama pull phi
docker exec -it analytics-ollama ollama pull llama2
```

---

## 🧪 **Testing Your Setup**

### **1. Check Ollama Accessibility:**
```bash
# From your host machine
curl http://localhost:11434/api/version

# From inside Docker container
docker exec -it your-backend-container curl http://ollama:11434/api/version
```

### **2. Check Backend Logs:**
```bash
# Check what URL the backend is trying
docker logs your-backend-container

# Look for messages like:
# "Trying to connect to Ollama at: http://localhost:11434"
# "Successfully connected to Ollama at: http://host.docker.internal:11434"
```

### **3. Test in Dashboard:**
1. Open the **Government Analytics Dashboard**
2. Go to **"Local AI Models"** section
3. Check **"Ollama Status"** - should show "Online"
4. Try **"Refresh Status"** button

---

## 🔍 **Troubleshooting**

### **❌ "Connection Refused"**
```bash
# Check if Ollama is running on host
ollama serve

# Check if port is accessible
netstat -an | grep 11434

# Windows: Check Docker Desktop network settings
```

### **❌ "Host not found"**
```bash
# For Windows/Mac, enable Docker Desktop host integration
# Docker Desktop > Settings > Resources > WSL Integration

# For Linux, check Docker bridge network
docker network inspect bridge
```

### **❌ "Models not appearing"**
```bash
# Install models in correct location
# If Ollama is on host:
ollama pull phi

# If Ollama is in Docker:
docker exec -it analytics-ollama ollama pull phi
```

### **❌ "Still can't connect"**
```bash
# Debug network connectivity
docker exec -it your-backend-container ping host.docker.internal
docker exec -it your-backend-container telnet host.docker.internal 11434

# Check all possible URLs
docker exec -it your-backend-container curl http://localhost:11434/api/version
docker exec -it your-backend-container curl http://host.docker.internal:11434/api/version
docker exec -it your-backend-container curl http://172.17.0.1:11434/api/version
```

---

## 📋 **Step-by-Step Fix**

### **For Your Current Setup:**

1. **Identify your environment:**
   ```bash
   # Are you using Docker Compose?
   docker-compose ps
   
   # What OS?
   echo $OS  # Windows/Linux/Mac
   ```

2. **Choose your OLLAMA_URL:**
   - **Windows/Mac**: `http://host.docker.internal:11434`
   - **Linux**: `http://172.17.0.1:11434`
   - **Docker Ollama**: `http://ollama:11434`

3. **Update your configuration:**
   ```bash
   # Option 1: Environment variable
   export OLLAMA_URL=http://host.docker.internal:11434
   
   # Option 2: Update .env file
   echo "OLLAMA_URL=http://host.docker.internal:11434" >> server/.env
   
   # Option 3: Update docker-compose.yml
   ```

4. **Restart services:**
   ```bash
   docker-compose restart backend
   # or
   docker-compose down && docker-compose up -d
   ```

5. **Verify in dashboard:**
   - Check "Local AI Models" section
   - Status should show "Online"

---

## 🏆 **Recommended Approach**

For **production government deployment**, use **Solution 3** (complete Docker setup):

### **Benefits:**
✅ **Isolated Environment** - Everything containerized  
✅ **Easy Deployment** - Single docker-compose command  
✅ **Consistent Setup** - Works same everywhere  
✅ **Easy Scaling** - Can add multiple Ollama instances  
✅ **Security** - Internal Docker network  

### **Commands:**
```bash
# Deploy complete stack
docker-compose -f docker-compose.ollama.yml up -d

# Install AI models
docker exec -it analytics-ollama ollama pull phi
docker exec -it analytics-ollama ollama pull llama2
docker exec -it analytics-ollama ollama pull mistral

# Monitor logs
docker-compose -f docker-compose.ollama.yml logs -f

# Access dashboard
open http://localhost:3000
```

---

## ✅ **Success Indicators**

You'll know it's working when:

1. **Dashboard shows:**
   - ✅ Ollama Status: **Online**
   - ✅ Installed Models: **1+**
   - ✅ Available models list appears

2. **Backend logs show:**
   ```
   [LocalAiService] Successfully connected to Ollama at: http://host.docker.internal:11434
   [LocalAiService] Found 3 installed Ollama models
   ```

3. **You can test models:**
   - Click "Test Local Model" button
   - Should get AI response without errors

---

**🐳 Docker networking can be tricky, but once configured properly, you'll have a robust, isolated AI analysis environment perfect for government use!** 