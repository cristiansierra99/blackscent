import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, ShoppingBag, MessageCircle, Trash2, X, Plus, Minus, 
  Copy, LogOut, Lock, CheckCircle, AlertCircle, Loader2,
  ChevronRight, Instagram, Facebook, Sparkles, Upload, Send,
  Wind, Droplets, Flame, Leaf, Zap
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { 
  collection, onSnapshot, addDoc, deleteDoc, updateDoc, 
  doc, setDoc, increment, query, orderBy 
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, signOut, onAuthStateChanged, User 
} from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { GoogleGenAI } from "@google/genai";
import { db, auth, storage } from './lib/firebase';

// --- Types ---
interface Product {
  id: string;
  name: string;
  price: number;
  oldPrice?: number | null;
  category: string;
  family?: string;
  accords?: { name: string, color: string, value: number }[]; // Fragrantica style accords
  stock: 'disponible' | 'agotado' | 'proximamente' | 'oferta';
  targetDate?: string;
  desc: string;
  notes?: string;
  img: string;
}

interface CartItem extends Product {
  qty: number;
}

interface Subscriber {
  id: string;
  email: string;
  date: any;
}

// --- Components ---

interface ToastData {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const AIAssistant = ({ products }: { products: Product[] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: '¡Hola! Soy tu asistente de Black Scent. ¿Buscas algo fresco para el día o algo intenso para la noche? Cuéntame qué te gusta.' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      console.log("Iniciando chat con mensaje:", userMsg);
      if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY no encontrada en process.env para chat");
        throw new Error('API_KEY_MISSING');
      }
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      const productContext = products.map(p => `- ${p.name}: ${p.desc} (${p.family || 'General'}). Notas: ${p.notes || 'No especificadas'}`).join('\n');
      
      const prompt = `Eres un sommelier de perfumes de lujo para la marca "Black Scent". 
      Tu objetivo es recomendar el perfume perfecto basado en los gustos del usuario.
      
      Catálogo disponible:
      ${productContext}
      
      Instrucciones:
      1. Sé elegante, breve y profesional.
      2. Si el usuario describe una situación (ej: "una cita", "el gimnasio"), recomienda 1 o 2 perfumes específicos de la lista.
      3. No menciones marcas externas, solo los nombres de nuestro catálogo.
      4. Si no hay nada que encaje perfectamente, recomienda el más versátil.
      
      Usuario dice: "${userMsg}"`;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      console.log("Respuesta de chat recibida:", response);
      setMessages(prev => [...prev, { role: 'ai', text: response.text || 'Lo siento, no pude procesar tu solicitud.' }]);
    } catch (err: any) {
      console.error("Error en Chat:", err);
      if (err.message === 'API_KEY_MISSING') {
        setMessages(prev => [...prev, { role: 'ai', text: '⚠️ Error de configuración: La llave de la IA (GEMINI_API_KEY) no ha sido configurada en el servidor de Azure. Por favor, contacta al administrador.' }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: 'Lo siento, tuve un problema al conectar con mi esencia. Inténtalo de nuevo.' }]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-28 right-8 z-40">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="absolute bottom-20 right-0 w-80 h-96 bg-[#0a0a0a] border border-gold-primary/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="bg-gold-primary p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-black" />
                <span className="text-black font-bold text-xs uppercase tracking-widest">Fragrance AI</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-black/50 hover:text-black"><X size={16} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-xl text-xs leading-relaxed ${
                    m.role === 'user' ? 'bg-gold-primary text-black' : 'bg-white/5 text-gray-300 border border-white/10'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <Loader2 size={12} className="animate-spin text-gold-primary" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-white/5 bg-black">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Escribe aquí..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-gold-primary outline-none"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <button onClick={handleSend} className="p-2 bg-gold-primary text-black rounded-lg hover:bg-gold-light transition-colors">
                  <Send size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-gold-primary text-black rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform relative group"
      >
        <Sparkles size={28} />
        <span className="absolute -top-12 right-0 bg-gold-primary text-black text-[10px] font-bold px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          ¿Te ayudo a elegir?
        </span>
      </button>
    </div>
  );
};
const Toast = ({ message, type = 'success', onClose }: { message: string, type?: 'success' | 'error', onClose: () => void, key?: React.Key }) => (
  <motion.div 
    initial={{ opacity: 0, x: 50 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 50 }}
    className={`fixed top-20 right-5 z-50 flex items-center gap-3 px-6 py-4 rounded-lg shadow-2xl border-l-4 ${
      type === 'success' ? 'bg-[#111] border-gold-primary' : 'bg-[#111] border-red-500'
    }`}
  >
    {type === 'success' ? <CheckCircle className="text-gold-primary w-5 h-5" /> : <AlertCircle className="text-red-500 w-5 h-5" />}
    <span className="text-white text-sm font-medium">{message}</span>
    <button onClick={onClose} className="ml-2 text-gray-500 hover:text-white">
      <X size={16} />
    </button>
  </motion.div>
);

const Countdown = ({ targetDate, variant = 'gold' }: { targetDate: string, variant?: 'gold' | 'red' }) => {
  const [timeLeft, setTimeLeft] = useState({ d: '00', h: '00', m: '00', s: '00' });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const diff = target - now;

      if (diff <= 0) {
        clearInterval(timer);
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({
        d: d.toString().padStart(2, '0'),
        h: h.toString().padStart(2, '0'),
        m: m.toString().padStart(2, '0'),
        s: s.toString().padStart(2, '0')
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const colorClass = variant === 'gold' ? 'text-gold-primary' : 'text-red-500';
  const bgClass = variant === 'gold' ? 'bg-gold-primary/10 border-gold-primary/30' : 'bg-red-500/10 border-red-500/30';

  return (
    <div className={`flex justify-center gap-2 p-2 rounded border mt-2 ${bgClass}`}>
      {['d', 'h', 'm', 's'].map((unit) => (
        <div key={unit} className="flex flex-col items-center min-w-[35px]">
          <span className={`font-serif font-bold text-lg leading-none ${colorClass}`}>
            {timeLeft[unit as keyof typeof timeLeft]}
          </span>
          <span className={`text-[10px] uppercase mt-0.5 ${colorClass}`}>{unit}</span>
        </div>
      ))}
    </div>
  );
};

export default function App() {
  // --- State ---
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [user, setUser] = useState<User | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [todayVisits, setTodayVisits] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // --- Auth & Data Fetching ---
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u));
    
    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
      setLoading(false);
    });

    // Track Visit
    const trackVisit = async () => {
      const today = new Date().toISOString().split('T')[0];
      const visitKey = `visited_${today}`;
      if (!sessionStorage.getItem(visitKey)) {
        sessionStorage.setItem(visitKey, 'true');
        await setDoc(doc(db, "visits", today), { count: increment(1) }, { merge: true });
      }
    };
    trackVisit();

    return () => {
      unsubAuth();
      unsubProducts();
    };
  }, []);

  useEffect(() => {
    if (user && isAdminOpen) {
      const unsubSubs = onSnapshot(query(collection(db, "subscribers"), orderBy("date", "desc")), (snapshot) => {
        setSubscribers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscriber)));
      });

      const today = new Date().toISOString().split('T')[0];
      const unsubVisits = onSnapshot(doc(db, "visits", today), (docSnap) => {
        if (docSnap.exists()) setTodayVisits(docSnap.data().count);
      });

      return () => {
        unsubSubs();
        unsubVisits();
      };
    }
  }, [user, isAdminOpen]);

  // --- Helpers ---
  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const getProductState = (prod: Product) => {
    const now = new Date().getTime();
    let state = prod.stock;
    if ((state === 'proximamente' || state === 'oferta') && prod.targetDate && new Date(prod.targetDate).getTime() <= now) {
      state = 'disponible';
    }
    return state;
  };

  const uploadImage = async (file: File) => {
    const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => getProductState(p) !== 'proximamente');
    
    if (filter !== 'all') {
      if (filter === 'hombre') result = result.filter(p => p.category === 'hombre' || p.category === 'unisex');
      else if (filter === 'mujer') result = result.filter(p => p.category === 'mujer' || p.category === 'unisex');
      else result = result.filter(p => p.category === filter);
    }

    if (familyFilter !== 'all') {
      result = result.filter(p => p.family === familyFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
    }

    return result.sort((a, b) => {
      const priority = { 'oferta': 1, 'disponible': 2, 'agotado': 3 };
      return (priority[getProductState(a)] || 2) - (priority[getProductState(b)] || 2);
    });
  }, [products, filter, familyFilter, searchQuery]);

  const upcomingProducts = useMemo(() => 
    products.filter(p => getProductState(p) === 'proximamente')
      .sort((a, b) => new Date(a.targetDate || '').getTime() - new Date(b.targetDate || '').getTime())
  , [products]);

  // --- Actions ---
  const addToCart = (prod: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === prod.id);
      if (existing) return prev.map(item => item.id === prod.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...prod, qty: 1 }];
    });
    addToast(`"${prod.name}" añadido al carrito`);
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id));
  
  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    let msg = "Hola Black Scent, me gustaría realizar el siguiente pedido:\n\n";
    cart.forEach(item => { msg += `- ${item.qty}x ${item.name} ($${item.price * item.qty})\n`; });
    msg += `\n*Total a pagar: $${cartTotal}.00*`;
    msg += "\n\nQuedo en espera de los datos de pago.";
    window.open(`https://wa.me/18096176188?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleSubscribe = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value;
    try {
      await addDoc(collection(db, "subscribers"), { email, date: new Date() });
      addToast("¡Gracias por suscribirte!");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      addToast("Error al suscribir", "error");
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value;
    const pass = (e.currentTarget.elements.namedItem('password') as HTMLInputElement).value;
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setIsLoginOpen(false);
      setIsAdminOpen(true);
      addToast("Acceso concedido");
    } catch (err) {
      addToast("Credenciales inválidas", "error");
    }
  };

  const [isSmartLoading, setIsSmartLoading] = useState(false);

  const handleSmartFill = async (formRef: HTMLFormElement) => {
    const name = (formRef.elements.namedItem('name') as HTMLInputElement).value;
    if (!name) {
      addToast("Escribe el nombre del perfume primero", "error");
      return;
    }

    setIsSmartLoading(true);
    addToast("Buscando información en Google...");

    try {
      console.log("Iniciando búsqueda inteligente para:", name);
      if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY no encontrada en process.env");
        throw new Error('API_KEY_MISSING');
      }
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      const prompt = `Utiliza Google Search para encontrar información REAL y VERIFICADA sobre el perfume "${name}".
      
      REQUISITOS DE DATOS:
      - Extrae los "Acordes Principales" (Main Accords) con su nombre, color representativo en hex y un valor de 0 a 100.
      - Descripción de 2 frases.
      - Notas de Salida, Corazón y Fondo.
      - Familia Olfativa (DEBE ser uno de estos: citrico, amaderado, floral, oriental, fresco, frutal, cuero, almizclado, dulce, chipre, aromatico, especiado, fougere, acuatico).
      
      Devuelve JSON:
      {
        "description": "...",
        "notes": "...",
        "family": "citrico | amaderado | floral | oriental | fresco | frutal | cuero | almizclado | dulce | chipre | aromatico | especiado | fougere | acuatico",
        "accords": [{"name": "...", "color": "...", "value": 100}, ...]
      }
      Responde SOLO el JSON.`;

      let response;
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json"
          }
        });
      } catch (searchErr: any) {
        const errorString = JSON.stringify(searchErr).toLowerCase() + (searchErr.message || "").toLowerCase();
        if (errorString.includes('429') || errorString.includes('quota') || errorString.includes('exhausted')) {
          console.warn("Cuota de búsqueda agotada, intentando sin Google Search...");
          addToast("Búsqueda limitada, usando conocimiento base...", "warning");
          response = await ai.models.generateContent({
            model,
            contents: `Genera información sobre el perfume "${name}" basándote en tu conocimiento. No uses Google Search.
            
            Devuelve JSON:
            {
              "description": "...",
              "notes": "...",
              "family": "citrico | amaderado | floral | oriental | fresco | frutal | cuero | almizclado | dulce | chipre | aromatico | especiado | fougere | acuatico",
              "accords": [{"name": "...", "color": "...", "value": 100}, ...]
            }
            Responde SOLO el JSON.`,
            config: {
              responseMimeType: "application/json"
            }
          });
        } else {
          throw searchErr;
        }
      }

      console.log("Respuesta de IA recibida:", response);
      const data = JSON.parse(response.text || '{}');
      console.log("Datos parseados:", data);
      
      if (data.description) (formRef.elements.namedItem('desc') as HTMLInputElement).value = data.description;
      if (data.notes) (formRef.elements.namedItem('notes') as HTMLTextAreaElement).value = data.notes;
      
      if (data.family) {
        const familySelect = formRef.elements.namedItem('family') as HTMLSelectElement;
        // Normalizar y buscar coincidencia
        const normalizedFamily = data.family.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const options = Array.from(familySelect.options);
        const match = options.find(opt => opt.value === normalizedFamily || opt.text.toLowerCase().includes(normalizedFamily));
        if (match) familySelect.value = match.value;
      }
      
      (formRef as any)._accords = data.accords;

      addToast("¡Información importada! Ahora pega el link de la imagen.");
    } catch (err: any) {
      console.error("Error en Smart Fill:", err);
      if (err.message === 'API_KEY_MISSING') {
        addToast("Error: GEMINI_API_KEY no configurada en Azure", "error");
      } else if (err.message?.includes('429') || err.message?.includes('quota')) {
        addToast("Cuota de IA agotada. Por favor, intenta de nuevo en unos minutos.", "error");
      } else {
        addToast(`Error: ${err.message || "No pude encontrar la información"}`, "error");
      }
    } finally {
      setIsSmartLoading(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct) return;
    
    try {
      const form = e.currentTarget;
      const fileInput = form.elements.namedItem('file') as HTMLInputElement;
      const imgInput = form.elements.namedItem('img') as HTMLInputElement;
      const nameInput = form.elements.namedItem('name') as HTMLInputElement;
      const priceInput = form.elements.namedItem('price') as HTMLInputElement;
      const oldPriceInput = form.elements.namedItem('oldPrice') as HTMLInputElement;
      const categorySelect = form.elements.namedItem('category') as HTMLSelectElement;
      const familySelect = form.elements.namedItem('family') as HTMLSelectElement;
      const stockSelect = form.elements.namedItem('stock') as HTMLSelectElement;
      const targetDateInput = form.elements.namedItem('targetDate') as HTMLInputElement;
      const descInput = form.elements.namedItem('desc') as HTMLInputElement;
      const notesInput = form.elements.namedItem('notes') as HTMLTextAreaElement;

      let imageUrl = imgInput?.value || editingProduct.img;

      if (fileInput?.files?.[0]) {
        addToast("Subiendo nueva imagen...");
        imageUrl = await uploadImage(fileInput.files[0]);
      }

      const data = {
        name: nameInput?.value || editingProduct.name,
        price: Number(priceInput?.value || 0),
        oldPrice: oldPriceInput?.value ? Number(oldPriceInput.value) : null,
        category: categorySelect?.value || editingProduct.category,
        family: familySelect?.value || editingProduct.family || '',
        accords: (form as any)._accords || editingProduct.accords || [],
        stock: (stockSelect?.value as any) || editingProduct.stock,
        targetDate: targetDateInput?.value || editingProduct.targetDate || '',
        desc: descInput?.value || editingProduct.desc,
        notes: notesInput?.value || editingProduct.notes || '',
        img: imageUrl
      };

      console.log("Updating product:", editingProduct.id, data);
      await updateDoc(doc(db, "products", editingProduct.id), data);
      addToast("Producto actualizado con éxito");
      setEditingProduct(null);
    } catch (err) {
      console.error("Update error:", err);
      addToast("Error al actualizar: " + (err instanceof Error ? err.message : "Error desconocido"), "error");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAdminOpen(false);
    addToast("Sesión cerrada");
  };

  const copySubscribers = () => {
    const emails = subscribers.map(s => s.email).join(', ');
    navigator.clipboard.writeText(emails);
    addToast("Correos copiados al portapapeles");
  };

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, 200]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);

  // --- Render ---
  return (
    <div className="min-h-screen bg-bg-black selection:bg-gold-primary/30 overflow-x-hidden">
      {/* Toasts */}
      <AnimatePresence>
        {toasts.map(t => (
          <Toast 
            key={t.id} 
            message={t.message} 
            type={t.type} 
            onClose={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))} 
          />
        ))}
      </AnimatePresence>

      {/* Header */}
      <header className="fixed top-0 w-full z-40 bg-bg-black/95 border-b border-gold-primary/10 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="https://ais-dev-uru7fbuvlp3bo4yq3ief6a-68095328393.us-east5.run.app/bs.jpeg" alt="Black Scent Logo" className="h-14 w-auto object-contain" referrerPolicy="no-referrer" />
            <div className="flex flex-col leading-none hidden sm:flex">
              <span className="font-serif text-xl tracking-[0.2em] text-white">BLACK SCENT</span>
              <span className="text-[8px] tracking-[0.4em] text-gold-primary uppercase mt-1">Parfums</span>
            </div>
          </div>

          <nav className="hidden md:flex gap-8 text-sm uppercase tracking-widest text-gray-400">
            <a href="#collection" className="hover:text-gold-primary transition-colors">Colección</a>
            <a href="#about" className="hover:text-gold-primary transition-colors">Nosotros</a>
            <a href="#contact" className="hover:text-gold-primary transition-colors">Contacto</a>
          </nav>

          <div className="flex items-center gap-6 text-gold-primary">
            <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="hover:scale-110 transition-transform">
              <Search size={22} />
            </button>
            <button onClick={() => setIsCartOpen(true)} className="relative hover:scale-110 transition-transform">
              <ShoppingBag size={22} />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {cart.reduce((s, i) => s + i.qty, 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-[#0a0a0a] border-b border-gold-primary/30 overflow-hidden"
            >
              <div className="container mx-auto px-6 py-4">
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Buscar perfume por nombre o notas..."
                  className="w-full bg-transparent border-none text-white text-lg focus:ring-0 placeholder:text-gray-600"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1615634260167-c8cdede054de?q=80&w=2070&auto=format&fit=crop" 
            className="w-full h-full object-cover opacity-60 scale-110"
            alt="Hero Background"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-bg-black/50 to-bg-black" />
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="relative z-10 text-center px-6"
        >
          <h1 className="font-serif text-5xl md:text-8xl text-white mb-6 tracking-tighter">MÁS QUE UN PERFUME</h1>
          <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto mb-10 font-light leading-relaxed">
            Inspiraciones de Alta Gama. La misma esencia, un nuevo nivel de exclusividad para quienes buscan dejar huella.
          </p>
          <a href="#collection" className="inline-block px-10 py-4 border border-gold-primary text-gold-primary uppercase tracking-widest text-sm hover:bg-gold-primary hover:text-black transition-all duration-500">
            Explorar Colección
          </a>
        </motion.div>
      </section>

      {/* Upcoming Section */}
      {upcomingProducts.length > 0 && (
        <section className="py-24 bg-[#080808] border-y border-white/5">
          <div className="container mx-auto px-6">
            <h2 className="font-serif text-4xl text-center text-gold-primary mb-16">Próximos Lanzamientos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {upcomingProducts.map(prod => (
                <div key={prod.id} className="luxury-card p-6 flex flex-col items-center text-center opacity-80">
                  <div className="relative w-full aspect-square mb-6 overflow-hidden group">
                    <img src={prod.img} className="w-full h-full object-contain blur-md grayscale transition-all duration-700 group-hover:blur-sm" alt="Upcoming" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-serif text-6xl text-white/20">?</span>
                    </div>
                  </div>
                  <h3 className="text-white uppercase tracking-widest mb-2 blur-[2px] hover:blur-none transition-all duration-500">{prod.name}</h3>
                  <Countdown targetDate={prod.targetDate || ''} />
                  <button 
                    onClick={() => window.open(`https://wa.me/18096176188?text=Me interesa el lanzamiento de ${prod.name}`, '_blank')}
                    className="mt-6 w-full py-3 border border-gray-700 text-gray-500 text-xs uppercase tracking-widest hover:border-white hover:text-white transition-colors"
                  >
                    Notificarme
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Collection */}
      <section id="collection" className="py-24 container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-16 gap-8">
          <h2 className="font-serif text-5xl text-gold-primary">Nuestra Colección</h2>
          
          <div className="flex flex-col gap-4 items-center md:items-end">
            <div className="flex flex-wrap justify-center gap-2">
              {['all', 'hombre', 'mujer', 'unisex', 'ninos', 'ninas'].map(cat => (
                <button 
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest border transition-all duration-300 ${
                    filter === cat ? 'border-gold-primary text-gold-primary bg-gold-primary/5' : 'border-gray-800 text-gray-500 hover:border-gray-600'
                  }`}
                >
                  {cat === 'all' ? 'Todos' : cat}
                </button>
              ))}
            </div>
            
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { id: 'all', label: 'Todas las Familias', icon: Sparkles },
                { id: 'citrico', label: 'Cítrico', icon: Droplets },
                { id: 'amaderado', label: 'Amaderado', icon: Wind },
                { id: 'floral', label: 'Floral', icon: Leaf },
                { id: 'oriental', label: 'Oriental', icon: Flame },
                { id: 'fresco', label: 'Fresco', icon: Zap }
              ].map(fam => (
                <button 
                  key={fam.id}
                  onClick={() => setFamilyFilter(fam.id)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest border transition-all duration-300 ${
                    familyFilter === fam.id ? 'border-gold-primary text-gold-primary bg-gold-primary/5' : 'border-gray-800 text-gray-500 hover:border-gray-600'
                  }`}
                >
                  <fam.icon size={10} />
                  {fam.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-gold-primary w-12 h-12 mb-4" />
            <p className="text-gray-500 uppercase tracking-widest text-xs">Cargando Esencias...</p>
          </div>
        ) : (
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10"
            >
              {filteredProducts.map((prod, idx) => {
                const state = getProductState(prod);
                const isAgotado = state === 'agotado';
                const isOffer = state === 'oferta';

                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: (idx % 4) * 0.1 }}
                    key={prod.id} 
                    className={`luxury-card p-6 flex flex-col group ${isAgotado ? 'opacity-60' : ''}`}
                  >
                  <div className="relative w-full aspect-square mb-6 overflow-hidden cursor-pointer" onClick={() => setSelectedProduct(prod)}>
                    <img 
                      src={prod.img} 
                      className={`w-full h-full object-contain transition-transform duration-700 group-hover:scale-110 ${isAgotado ? 'grayscale' : ''}`} 
                      alt={prod.name} 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x400?text=Imagen+No+Disponible';
                      }}
                    />
                    {isAgotado && <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] px-2 py-1 font-bold uppercase tracking-tighter">Agotado</div>}
                    {isOffer && <div className="absolute top-2 right-2 bg-gold-primary text-black text-[10px] px-2 py-1 font-bold uppercase tracking-tighter animate-pulse">Oferta</div>}
                  </div>

                  <div className="text-center flex-1">
                    <h3 className="text-white text-sm uppercase tracking-widest mb-1 font-medium">{prod.name}</h3>
                    <p className="text-gray-600 text-[10px] mb-4 line-clamp-1">{prod.desc}</p>
                    
                    <div className="font-serif text-lg text-gold-primary mb-4 italic">
                      {isOffer && prod.oldPrice ? (
                        <div className="flex justify-center items-center gap-2">
                          <span className="text-gray-600 text-sm line-through font-sans not-italic">${prod.oldPrice}</span>
                          <span className="text-red-500">${prod.price}.00</span>
                        </div>
                      ) : (
                        <span>${prod.price}.00</span>
                      )}
                    </div>

                    {isOffer && prod.targetDate && <Countdown targetDate={prod.targetDate} variant="red" />}
                  </div>

                  <button 
                    disabled={isAgotado}
                    onClick={() => isAgotado ? window.open(`https://wa.me/18096176188?text=Me interesa ${prod.name}`, '_blank') : addToCart(prod)}
                    className={`mt-6 w-full py-3 text-[10px] uppercase tracking-[0.2em] border transition-all duration-500 ${
                      isAgotado 
                        ? 'border-gray-800 text-gray-600 hover:bg-gray-800 hover:text-white' 
                        : 'border-gray-800 text-gray-400 group-hover:bg-gold-primary group-hover:text-black group-hover:border-gold-primary group-hover:font-bold'
                    }`}
                  >
                    {isAgotado ? 'Avísame' : 'Añadir al Carrito'}
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </section>

      {/* Newsletter */}
      <section id="contact" className="py-24 bg-linear-to-t from-[#080808] to-bg-black border-t border-white/5">
        <div className="container mx-auto px-6 text-center max-w-3xl">
          <h2 className="font-serif text-4xl text-white mb-4">Mantente Informado</h2>
          <p className="text-gray-500 mb-10 font-light">Suscríbete para recibir notificaciones exclusivas de nuevos lanzamientos, reposiciones y ofertas secretas.</p>
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4">
            <input 
              name="email"
              type="email" 
              required
              placeholder="Tu correo electrónico"
              className="flex-1 bg-black border border-gray-800 px-6 py-4 text-white focus:border-gold-primary outline-none transition-colors"
            />
            <button type="submit" className="px-10 py-4 bg-gold-primary text-black uppercase tracking-widest text-xs font-bold hover:bg-gold-light transition-colors">
              Suscribirme
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 text-center bg-[#050505]">
        <div className="container mx-auto px-6">
          <div className="flex flex-col items-center mb-12">
            <img src="https://ais-dev-uru7fbuvlp3bo4yq3ief6a-68095328393.us-east5.run.app/bs.jpeg" alt="Black Scent Logo" className="h-24 w-auto mb-6 opacity-80 hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
            <div className="flex justify-center gap-8 text-gray-500">
              <a href="#" className="hover:text-gold-primary transition-all hover:scale-110"><Instagram size={22} /></a>
              <a href="#" className="hover:text-gold-primary transition-all hover:scale-110"><Facebook size={22} /></a>
              <a href="https://wa.me/573123456789" target="_blank" className="hover:text-gold-primary transition-all hover:scale-110"><MessageCircle size={22} /></a>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-left mb-16 border-y border-white/5 py-12">
            <div>
              <h4 className="text-gold-primary uppercase tracking-widest text-xs font-bold mb-6">Nuestra Esencia</h4>
              <p className="text-gray-500 text-sm leading-relaxed">
                Black Scent Parfums redefine el lujo a través de inspiraciones olfativas de la más alta gama, permitiendo que la exclusividad sea parte de tu día a día.
              </p>
            </div>
            <div>
              <h4 className="text-gold-primary uppercase tracking-widest text-xs font-bold mb-6">Atención al Cliente</h4>
              <ul className="text-gray-500 text-sm space-y-3">
                <li><a href="#" className="hover:text-white transition-colors">Envíos Nacionales</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Garantía de Calidad</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Preguntas Frecuentes</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-gold-primary uppercase tracking-widest text-xs font-bold mb-6">Contacto</h4>
              <ul className="text-gray-500 text-sm space-y-3">
                <li>Bogotá, Colombia</li>
                <li>WhatsApp: +57 312 345 6789</li>
                <li>Email: info@blackscent.com</li>
              </ul>
            </div>
          </div>

          <p className="text-gray-600 text-xs mb-4">&copy; {new Date().getFullYear()} Black Scent Parfums. Todos los derechos reservados.</p>
          <p className="text-gray-700 text-[10px] max-w-2xl mx-auto leading-relaxed">
            *Aviso Legal: Nuestras fragancias son inspiraciones olfativas de alta calidad y no tienen relación comercial con las marcas registradas originales. Los nombres se utilizan únicamente como referencia olfativa.
          </p>
          <button onClick={() => setIsLoginOpen(true)} className="mt-12 text-gray-800 hover:text-gold-primary transition-colors flex items-center gap-2 mx-auto text-[10px] uppercase tracking-[0.3em] font-bold">
            <Lock size={12} /> Admin Access
          </button>
        </div>
      </footer>

      {/* --- Modals & Sidebars --- */}

      {/* Cart Sidebar */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-[#0a0a0a] border-l border-gold-primary/20 z-50 flex flex-col"
            >
              <div className="p-8 flex justify-between items-center border-b border-white/5">
                <div className="flex items-center gap-3">
                  <img src="https://ais-dev-uru7fbuvlp3bo4yq3ief6a-68095328393.us-east5.run.app/bs.jpeg" alt="Logo" className="h-8 w-auto" referrerPolicy="no-referrer" />
                  <h2 className="font-serif text-2xl text-gold-primary">Tu Compra</h2>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="text-gray-500 hover:text-white"><X /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <ShoppingBag size={48} className="text-gray-800 mb-4" />
                    <p className="text-gray-600 uppercase tracking-widest text-xs">Tu carrito está vacío</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex gap-4 border-b border-white/5 pb-6">
                      <img src={item.img} className="w-20 h-20 object-contain bg-black p-2" alt={item.name} referrerPolicy="no-referrer" />
                      <div className="flex-1">
                        <h4 className="text-white text-sm uppercase tracking-wide mb-1">{item.name}</h4>
                        <p className="text-gold-primary font-serif italic mb-3">${item.price}.00</p>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center border border-gray-800 rounded">
                            <button onClick={() => updateQty(item.id, -1)} className="p-1 text-gray-500 hover:text-white"><Minus size={14} /></button>
                            <span className="w-8 text-center text-xs text-white">{item.qty}</span>
                            <button onClick={() => updateQty(item.id, 1)} className="p-1 text-gray-500 hover:text-white"><Plus size={14} /></button>
                          </div>
                          <button onClick={() => removeFromCart(item.id)} className="text-red-500/50 hover:text-red-500 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-white font-serif">${item.price * item.qty}.00</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-8 border-t border-white/5 bg-black/50">
                  <div className="flex justify-between items-center mb-8">
                    <span className="text-gray-400 uppercase tracking-widest text-xs">Total Estimado</span>
                    <span className="text-2xl font-serif text-white">${cartTotal}.00</span>
                  </div>
                  <button 
                    onClick={handleCheckout}
                    className="w-full py-4 bg-gold-primary text-black font-bold uppercase tracking-[0.2em] text-xs hover:bg-gold-light transition-colors flex items-center justify-center gap-3"
                  >
                    Completar Pedido <ChevronRight size={16} />
                  </button>
                  <p className="text-center text-[10px] text-gray-600 mt-4 uppercase tracking-widest">Finaliza tu compra vía WhatsApp</p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-black/90 backdrop-blur-md z-50"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-[#0a0a0a] border border-gold-primary/30 z-50 p-8 md:p-12 overflow-y-auto max-h-[90vh]"
            >
              <button onClick={() => setSelectedProduct(null)} className="absolute top-6 right-6 text-gray-500 hover:text-white"><X /></button>
              
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="flex flex-col gap-8">
                  <div className="bg-black p-8 rounded-lg aspect-square flex items-center justify-center">
                    <img 
                      src={selectedProduct.img} 
                      className="max-w-full max-h-full object-contain" 
                      alt={selectedProduct.name} 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x400?text=Imagen+No+Disponible';
                      }}
                    />
                  </div>
                  
                  {/* Fragrantica Style Accords */}
                  {selectedProduct.accords && selectedProduct.accords.length > 0 && (
                    <div className="space-y-1.5 mt-8">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-6 text-center font-bold">Acordes Principales</p>
                      <div className="flex flex-col items-start w-full">
                        {selectedProduct.accords.map((acc, i) => (
                          <motion.div 
                            key={i}
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: `${acc.value}%`, opacity: 1 }}
                            transition={{ delay: 0.3 + (i * 0.1), duration: 0.8 }}
                            className="h-8 flex items-center px-4 relative mb-1.5 rounded-r-full shadow-xl border-y border-r border-white/10"
                            style={{ 
                              backgroundColor: acc.color,
                              marginLeft: `${i * 12}px`, // Staggered diagonal effect
                              maxWidth: `calc(100% - ${i * 12}px)`,
                              minWidth: '80px'
                            }}
                          >
                            <span className="text-[10px] font-bold text-black uppercase tracking-widest whitespace-nowrap drop-shadow-sm">
                              {acc.name}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="font-serif text-4xl text-gold-primary mb-4">{selectedProduct.name}</h2>
                  <div className="text-2xl font-serif text-white mb-6 italic">${selectedProduct.price}.00</div>
                  
                  <div className="space-y-6 text-gray-400 font-light leading-relaxed">
                    <p>{selectedProduct.desc}</p>
                    {selectedProduct.notes && (
                      <div className="p-4 bg-white/5 border-l-2 border-gold-primary italic">
                        <p className="text-sm text-gray-300">"{selectedProduct.notes}"</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-10 flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                      className="flex-1 py-4 bg-gold-primary text-black font-bold uppercase tracking-widest text-xs hover:bg-gold-light transition-colors"
                    >
                      Añadir al Carrito
                    </button>
                    <button 
                      onClick={() => window.open(`https://wa.me/18096176188?text=Hola, me interesa el perfume ${selectedProduct.name}`, '_blank')}
                      className="flex-1 py-4 border border-gray-700 text-white uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all"
                    >
                      Consultar Stock
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {isLoginOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLoginOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#111] border border-gold-primary/30 z-50 p-10"
            >
              <div className="flex flex-col items-center mb-8">
                <img src="https://ais-dev-uru7fbuvlp3bo4yq3ief6a-68095328393.us-east5.run.app/bs.jpeg" alt="Logo" className="h-16 w-auto mb-4" referrerPolicy="no-referrer" />
                <h3 className="font-serif text-2xl text-center text-white">Acceso Administrativo</h3>
              </div>
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Email</label>
                  <input name="email" type="email" required className="w-full bg-black border border-gray-800 p-3 text-white focus:border-gold-primary outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Password</label>
                  <input name="password" type="password" required className="w-full bg-black border border-gray-800 p-3 text-white focus:border-gold-primary outline-none" />
                </div>
                <button type="submit" className="w-full py-4 bg-gold-primary text-black font-bold uppercase tracking-widest text-xs">Entrar</button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Admin Panel Modal */}
      <AnimatePresence>
        {isAdminOpen && user && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/95 z-50 overflow-y-auto"
            >
              <div className="container mx-auto px-6 py-12">
                <div className="flex justify-between items-center mb-12 border-b border-white/5 pb-8">
                  <div className="flex items-center gap-6">
                    <img src="https://ais-dev-uru7fbuvlp3bo4yq3ief6a-68095328393.us-east5.run.app/bs.jpeg" alt="Logo" className="h-16 w-auto" referrerPolicy="no-referrer" />
                    <div>
                      <h2 className="font-serif text-4xl text-gold-primary">Panel de Control</h2>
                      <p className="text-gray-500 text-xs uppercase tracking-widest mt-2">Bienvenido, Administrador</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-white/5 px-6 py-3 rounded border border-white/10 text-center">
                      <span className="block text-gold-primary font-bold text-xl">{todayVisits}</span>
                      <span className="text-[8px] uppercase tracking-widest text-gray-500">Visitas Hoy</span>
                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-2 px-6 py-3 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-all text-xs uppercase tracking-widest">
                      <LogOut size={14} /> Salir
                    </button>
                    <button onClick={() => setIsAdminOpen(false)} className="p-3 bg-white/5 text-white hover:bg-white/10 transition-all">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-12">
                  {/* Form Column */}
                  <div className="lg:col-span-1 space-y-8">
                    <div className="bg-[#0a0a0a] border border-white/5 p-8">
                      <h3 className="text-white uppercase tracking-widest text-sm mb-8 border-b border-white/5 pb-4">Nuevo Producto</h3>
                      <form id="newProductForm" className="space-y-6" onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const fileInput = form.elements.namedItem('file') as HTMLInputElement;
                        let imageUrl = (form.elements.namedItem('img') as HTMLInputElement).value || 'https://via.placeholder.com/300';

                        if (fileInput.files?.[0]) {
                          addToast("Subiendo imagen...");
                          imageUrl = await uploadImage(fileInput.files[0]);
                        }

                        const data = {
                          name: (form.elements.namedItem('name') as HTMLInputElement).value,
                          price: Number((form.elements.namedItem('price') as HTMLInputElement).value),
                          oldPrice: (form.elements.namedItem('oldPrice') as HTMLInputElement).value ? Number((form.elements.namedItem('oldPrice') as HTMLInputElement).value) : null,
                          category: (form.elements.namedItem('category') as HTMLSelectElement).value,
                          family: (form.elements.namedItem('family') as HTMLSelectElement).value,
                          accords: (form as any)._accords || [],
                          stock: (form.elements.namedItem('stock') as HTMLSelectElement).value as any,
                          targetDate: (form.elements.namedItem('targetDate') as HTMLInputElement).value,
                          desc: (form.elements.namedItem('desc') as HTMLInputElement).value,
                          notes: (form.elements.namedItem('notes') as HTMLTextAreaElement).value,
                          img: imageUrl
                        };
                        await addDoc(collection(db, "products"), data);
                        addToast("Producto creado");
                        form.reset();
                      }}>
                        <div className="flex gap-2">
                          <input name="name" placeholder="Nombre del Perfume" required className="flex-1 bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none" />
                          <button 
                            type="button" 
                            disabled={isSmartLoading}
                            onClick={() => handleSmartFill(document.getElementById('newProductForm') as HTMLFormElement)}
                            className="px-4 bg-gold-primary/10 border border-gold-primary/30 text-gold-primary hover:bg-gold-primary hover:text-black transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold"
                          >
                            {isSmartLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            IA
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <input name="price" type="number" placeholder="Precio ($)" required className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none" />
                          <input name="oldPrice" type="number" placeholder="Precio Ant. ($)" className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <select name="category" required className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none">
                            <option value="hombre">Hombre</option>
                            <option value="mujer">Mujer</option>
                            <option value="unisex">Unisex</option>
                            <option value="ninos">Niños</option>
                            <option value="ninas">Niñas</option>
                          </select>
                          <select name="family" required className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none">
                            <option value="">Seleccione Familia</option>
                            <option value="citrico">Cítrico</option>
                            <option value="amaderado">Amaderado</option>
                            <option value="floral">Floral</option>
                            <option value="oriental">Oriental</option>
                            <option value="fresco">Fresco</option>
                            <option value="frutal">Frutal</option>
                            <option value="cuero">Cuero</option>
                            <option value="almizclado">Almizclado</option>
                            <option value="dulce">Dulce / Gourmet</option>
                            <option value="chipre">Chipre</option>
                            <option value="aromatico">Aromático</option>
                            <option value="especiado">Especiado</option>
                            <option value="fougere">Fougère</option>
                            <option value="acuatico">Acuático</option>
                          </select>
                        </div>
                        <select name="stock" required className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none">
                          <option value="disponible">Disponible</option>
                          <option value="agotado">Agotado</option>
                          <option value="proximamente">Próximamente</option>
                          <option value="oferta">Oferta Especial</option>
                        </select>
                        <input name="targetDate" type="datetime-local" className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none" />
                        <input name="desc" placeholder="Descripción corta" required className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none" />
                        <textarea name="notes" placeholder="Notas olfativas..." rows={3} className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none" />
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] uppercase text-gray-500 flex items-center gap-2"><Upload size={12} /> Imagen del Producto</label>
                            <button 
                              type="button"
                              onClick={() => {
                                const name = (document.getElementById('newProductForm') as HTMLFormElement).elements.namedItem('name') as HTMLInputElement;
                                if (name.value) window.open(`https://www.google.com/search?q=${encodeURIComponent(name.value + ' perfume bottle white background png')}&tbm=isch`, '_blank');
                              }}
                              className="text-[9px] text-gold-primary hover:underline uppercase tracking-tighter"
                            >
                              Buscar en Google
                            </button>
                          </div>
                          
                          {/* Image Preview */}
                          <div className="w-full aspect-square bg-black border border-gray-800 rounded flex items-center justify-center overflow-hidden mb-2">
                            <img 
                              id="newProductPreview"
                              src="https://picsum.photos/seed/perfume/400/400" 
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/perfume/400/400'}
                            />
                          </div>

                          <input name="file" type="file" accept="image/*" className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-gold-primary file:text-black hover:file:bg-gold-light" />
                          <input 
                            name="img" 
                            placeholder="O pega URL de Imagen" 
                            className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none" 
                            onChange={(e) => {
                              let val = e.target.value;
                              // Limpiar si es redirect de Google
                              try {
                                const urlObj = new URL(val);
                                if (urlObj.hostname.includes('google.com') && urlObj.searchParams.has('imgurl')) {
                                  val = urlObj.searchParams.get('imgurl') || val;
                                  e.target.value = val;
                                }
                              } catch (err) { /* ignore */ }
                              
                              const preview = document.getElementById('newProductPreview') as HTMLImageElement;
                              if (preview) preview.src = val || 'https://picsum.photos/seed/perfume/400/400';
                            }}
                          />
                          <p className="text-[9px] text-gray-600 italic">Tip: En Google, clic derecho sobre la imagen y selecciona "Copiar dirección de imagen".</p>
                        </div>
                        <button type="submit" className="w-full py-4 bg-gold-primary text-black font-bold uppercase tracking-widest text-xs">Crear Producto</button>
                      </form>
                    </div>

                    <div className="bg-[#0a0a0a] border border-white/5 p-8">
                      <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
                        <h3 className="text-white uppercase tracking-widest text-sm">Suscriptores</h3>
                        <button onClick={copySubscribers} className="text-gold-primary hover:text-white transition-colors"><Copy size={16} /></button>
                      </div>
                      <div className="max-height-[300px] overflow-y-auto space-y-3">
                        {subscribers.map(s => (
                          <div key={s.id} className="text-xs text-gray-500 flex justify-between items-center bg-black p-3 border border-white/5">
                            <span className="truncate mr-2">{s.email}</span>
                            <button onClick={() => deleteDoc(doc(db, "subscribers", s.id))} className="text-red-500/30 hover:text-red-500"><Trash2 size={12} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* List Column */}
                  <div className="lg:col-span-2">
                    <div className="bg-[#0a0a0a] border border-white/5 p-8">
                      <h3 className="text-white uppercase tracking-widest text-sm mb-8 border-b border-white/5 pb-4">Inventario Real-Time</h3>
                      <div className="space-y-4">
                        {products.map(prod => (
                          <div key={prod.id} className="flex items-center gap-4 bg-black p-4 border border-white/5 hover:border-gold-primary/30 transition-all">
                            <img src={prod.img} className="w-12 h-12 object-contain bg-white/5 p-1" alt="Admin" referrerPolicy="no-referrer" />
                            <div className="flex-1">
                              <h4 className="text-white text-sm font-medium">{prod.name}</h4>
                              <div className="flex gap-3 mt-1">
                                <span className={`text-[8px] uppercase font-bold px-2 py-0.5 rounded ${
                                  prod.stock === 'disponible' ? 'bg-green-500/10 text-green-500' :
                                  prod.stock === 'agotado' ? 'bg-red-500/10 text-red-500' :
                                  prod.stock === 'proximamente' ? 'bg-blue-500/10 text-blue-500' : 'bg-gold-primary/10 text-gold-primary'
                                }`}>
                                  {prod.stock}
                                </span>
                                <span className="text-[8px] uppercase text-gray-600 tracking-widest">{prod.category}</span>
                                <span className="text-[8px] text-gold-primary font-serif italic">${prod.price}.00</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setEditingProduct(prod)}
                                className="p-2 bg-white/5 text-gray-500 hover:text-gold-primary transition-colors"
                                title="Editar"
                              >
                                <ChevronRight size={16} className="rotate-90" />
                              </button>
                              <button 
                                onClick={async () => {
                                  const newStock = prod.stock === 'disponible' ? 'agotado' : 'disponible';
                                  await updateDoc(doc(db, "products", prod.id), { stock: newStock });
                                  addToast(`Stock actualizado: ${prod.name}`);
                                }}
                                className="p-2 bg-white/5 text-gray-500 hover:text-gold-primary transition-colors"
                              >
                                {prod.stock === 'disponible' ? <Minus size={16} /> : <Plus size={16} />}
                              </button>
                              <button 
                                onClick={() => deleteDoc(doc(db, "products", prod.id))}
                                className="p-2 bg-white/5 text-gray-500 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Product Modal */}
      <AnimatePresence>
        {editingProduct && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingProduct(null)}
              className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-[#0a0a0a] border border-gold-primary/30 z-[70] p-8 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
                <h3 className="text-gold-primary font-serif text-2xl">Editar Producto</h3>
                <button onClick={() => setEditingProduct(null)} className="text-gray-500 hover:text-white"><X /></button>
              </div>
              <form id="editProductForm" className="space-y-6" onSubmit={handleUpdateProduct}>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Nombre</label>
                  <div className="flex gap-2">
                    <input name="name" defaultValue={editingProduct.name} required className="flex-1 bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none" />
                    <button 
                      type="button" 
                      disabled={isSmartLoading}
                      onClick={() => handleSmartFill(document.getElementById('editProductForm') as HTMLFormElement)}
                      className="px-4 bg-gold-primary/10 border border-gold-primary/30 text-gold-primary hover:bg-gold-primary hover:text-black transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold"
                    >
                      {isSmartLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      IA
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Precio ($)</label>
                    <input name="price" type="number" defaultValue={editingProduct.price} required className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Precio Anterior ($)</label>
                    <input name="oldPrice" type="number" defaultValue={editingProduct.oldPrice || ''} className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Categoría</label>
                    <select name="category" defaultValue={editingProduct.category} required className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none">
                      <option value="hombre">Hombre</option>
                      <option value="mujer">Mujer</option>
                      <option value="unisex">Unisex</option>
                      <option value="ninos">Niños</option>
                      <option value="ninas">Niñas</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Familia Olfativa</label>
                    <select name="family" defaultValue={editingProduct.family} required className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none">
                      <option value="">Seleccione Familia</option>
                      <option value="citrico">Cítrico</option>
                      <option value="amaderado">Amaderado</option>
                      <option value="floral">Floral</option>
                      <option value="oriental">Oriental</option>
                      <option value="fresco">Fresco</option>
                      <option value="frutal">Frutal</option>
                      <option value="cuero">Cuero</option>
                      <option value="almizclado">Almizclado</option>
                      <option value="dulce">Dulce / Gourmet</option>
                      <option value="chipre">Chipre</option>
                      <option value="aromatico">Aromático</option>
                      <option value="especiado">Especiado</option>
                      <option value="fougere">Fougère</option>
                      <option value="acuatico">Acuático</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Estado</label>
                  <select name="stock" defaultValue={editingProduct.stock} required className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none">
                    <option value="disponible">Disponible</option>
                    <option value="agotado">Agotado</option>
                    <option value="proximamente">Próximamente</option>
                    <option value="oferta">Oferta Especial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Fecha Límite (Oferta/Lanzamiento)</label>
                  <input name="targetDate" type="datetime-local" defaultValue={editingProduct.targetDate} className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Descripción Corta</label>
                  <input name="desc" defaultValue={editingProduct.desc} required className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Notas Olfativas</label>
                  <textarea name="notes" defaultValue={editingProduct.notes} rows={3} className="w-full bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-bold">Imagen del Producto</label>
                  
                  {/* Edit Image Preview */}
                  <div className="w-full aspect-square bg-black border border-gray-800 rounded flex items-center justify-center overflow-hidden mb-4">
                    <img 
                      id="editProductPreview"
                      src={editingProduct.img} 
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/perfume/400/400'}
                    />
                  </div>

                  <div className="flex gap-2 mb-2">
                    <input 
                      name="img" 
                      defaultValue={editingProduct.img} 
                      placeholder="URL de Imagen"
                      className="flex-1 bg-black border border-gray-800 p-3 text-white text-sm focus:border-gold-primary outline-none" 
                      onChange={(e) => {
                        let val = e.target.value;
                        try {
                          const urlObj = new URL(val);
                          if (urlObj.hostname.includes('google.com') && urlObj.searchParams.has('imgurl')) {
                            val = urlObj.searchParams.get('imgurl') || val;
                            e.target.value = val;
                          }
                        } catch (err) { /* ignore */ }

                        const preview = document.getElementById('editProductPreview') as HTMLImageElement;
                        if (preview) preview.src = val || 'https://picsum.photos/seed/perfume/400/400';
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        const name = (document.getElementById('editProductForm') as HTMLFormElement).elements.namedItem('name') as HTMLInputElement;
                        if (name.value) window.open(`https://www.google.com/search?q=${encodeURIComponent(name.value + ' perfume bottle white background png')}&tbm=isch`, '_blank');
                      }}
                      className="px-3 bg-white/5 text-gold-primary border border-white/10 hover:bg-gold-primary hover:text-black transition-all text-[9px] uppercase font-bold"
                    >
                      Google
                    </button>
                  </div>
                  <input name="file" type="file" accept="image/*" className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-gold-primary file:text-black hover:file:bg-gold-light" />
                  <p className="text-[9px] text-gray-600 italic mt-1">Tip: En Google, clic derecho &rarr; "Copiar dirección de imagen".</p>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-4 border border-gray-800 text-gray-500 uppercase tracking-widest text-xs hover:bg-white/5 hover:text-white transition-all">Cancelar</button>
                  <button type="submit" className="flex-1 py-4 bg-gold-primary text-black font-bold uppercase tracking-widest text-xs hover:bg-gold-light transition-colors">Guardar Cambios</button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* AIAssistant */}
      <AIAssistant products={products} />

      {/* Floating WhatsApp */}
      <a 
        href="https://wa.me/18096176188" 
        target="_blank" 
        rel="noreferrer"
        className="fixed bottom-8 right-8 w-16 h-16 bg-[#25d366] text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform z-30"
      >
        <MessageCircle size={32} />
      </a>
    </div>
  );
}
