import React, { useState, useEffect, useRef } from "react";
import { 
  auth, 
  db, 
  signInWithGoogle, 
  signInQuickAccess,
  handleFirestoreError,
  OperationType
} from "./firebase";
import { predictPrice, analyzeQuality, processVoiceCommand, getLocationName } from "./ai";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GmailHub } from "./components/GmailHub";
import { getGmailAccessToken, isGmailConnected } from "./lib/gmail";
import { getT } from "./lib/i18n";
import { 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser 
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  where,
  or,
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  deleteDoc,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";
import { 
  Camera, 
  TrendingUp, 
  ShoppingBag, 
  User as UserIcon, 
  LogOut, 
  Mic, 
  Plus, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Leaf,
  MessageSquare,
  Send,
  ExternalLink,
  ShoppingCart,
  Package,
  CreditCard,
  Truck,
  CheckCircle2,
  Clock,
  Trash2,
  Minus,
  PlusCircle,
  Bell,
  X,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  Smartphone,
  Mail,
  Languages
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { translations, languages, LanguageCode } from "./translations";

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Product {
  id: string;
  name: string;
  crop: string;
  price: number;
  location: string;
  authorUid: string;
  authorName: string;
  createdAt: any;
  grade?: string;
  imageUrl?: string;
}

interface UserProfile {
  name: string;
  phone: string;
  email?: string;
  role: "farmer" | "buyer" | "admin";
  language?: LanguageCode;
  createdAt: any;
  walletBalance?: number;
  paymentDetails?: {
    upiId?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
  };
}

interface Transaction {
  id: string;
  userId: string;
  type: "credit" | "debit";
  category: "sale" | "withdrawal" | "commission";
  amount: number;
  status: "pending" | "completed" | "failed";
  description: string;
  orderId?: string;
  createdAt: any;
}

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "order" | "payment" | "system";
  isRead: boolean;
  createdAt: any;
  orderId?: string;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  productId?: string;
  productName?: string;
  text: string;
  createdAt: any;
}

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  sellerId: string;
  sellerName: string;
}

interface Order {
  id: string;
  buyerId: string;
  buyerName: string;
  items: CartItem[];
  totalAmount: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  paymentMethod: "upi" | "card" | "netbanking" | "cod";
  paymentStatus: "pending" | "paid" | "failed";
  createdAt: any;
  address: string;
  phone: string;
  sellerIds: string[];
}

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost', size?: 'default' | 'sm' | 'lg' | 'icon' }>(
  ({ className, variant = 'primary', size = 'default', ...props }, ref) => {
    const variants = {
      primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
      secondary: "bg-amber-500 text-white hover:bg-amber-600 shadow-sm",
      outline: "border border-emerald-600 text-emerald-600 hover:bg-emerald-50",
      ghost: "text-emerald-600 hover:bg-emerald-100"
    };
    const sizes = {
      default: "px-4 py-2",
      sm: "px-3 py-1.5 text-sm",
      lg: "px-6 py-3 text-lg",
      icon: "p-2"
    };
    return (
      <button
        ref={ref}
        className={cn(
          "rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all",
        className
      )}
      {...props}
    />
  )
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden", className)}>
    {children}
  </div>
);

// --- Main App ---

const LanguageModalContent = ({ onSelect, t }: { onSelect: (code: LanguageCode) => void, t: (key: string) => string }) => (
  <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
    <div className="p-8 text-center space-y-6">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
        <Languages className="w-10 h-10 text-emerald-600" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-900">{t('choose_language')}</h2>
        <p className="text-slate-500">{t('select_language_desc')}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => onSelect(lang.code as LanguageCode)}
            className="p-4 rounded-2xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-center group"
          >
            <p className="font-bold text-slate-900 group-hover:text-emerald-700">{lang.native}</p>
            <p className="text-xs text-slate-400">{lang.name}</p>
          </button>
        ))}
      </div>
    </div>
  </div>
);

const OrderTracking = ({ status, t }: { status: string, t: (key: string) => string }) => {
  const steps = [
    { key: "pending", label: t('status_pending'), icon: ShoppingBag },
    { key: "processing", label: t('status_processing'), icon: Clock },
    { key: "shipped", label: t('status_shipped'), icon: Truck },
    { key: "delivered", label: t('status_delivered'), icon: CheckCircle2 },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === status);
  const isCancelled = status === "cancelled";

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 text-red-600 font-bold p-4 bg-red-50 rounded-xl border border-red-100 my-4">
        <AlertCircle className="w-5 h-5" />
        ORDER CANCELLED
      </div>
    );
  }

  return (
    <div className="w-full py-10 px-4">
      <div className="flex items-center justify-between relative max-w-2xl mx-auto">
        {/* Progress Line Background */}
        <div className="absolute top-5 left-0 w-full h-1 bg-slate-100 z-0 rounded-full" />
        
        {/* Active Progress Line */}
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${(Math.max(0, currentStepIndex) / (steps.length - 1)) * 100}%` }}
          className="absolute top-5 left-0 h-1 bg-emerald-500 z-0 rounded-full transition-all duration-700" 
        />

        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;

          return (
            <div key={step.key} className="flex flex-col items-center relative z-10">
              <motion.div 
                initial={false}
                animate={{ 
                  scale: isCurrent ? 1.2 : 1,
                  backgroundColor: isCompleted ? "#10b981" : "#f8fafc",
                  color: isCompleted ? "#ffffff" : "#94a3b8",
                  borderColor: isCurrent ? "#10b981" : isCompleted ? "#10b981" : "#e2e8f0"
                }}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 shadow-sm",
                  isCurrent && "shadow-emerald-200 shadow-lg ring-4 ring-emerald-50"
                )}
              >
                <Icon className={cn("w-5 h-5", isCurrent && "animate-pulse")} />
              </motion.div>
              <div className="mt-3 text-center">
                <p className={cn(
                  "text-[10px] font-bold uppercase tracking-tighter whitespace-nowrap",
                  isCompleted ? "text-emerald-700" : "text-slate-400"
                )}>
                  {step.label}
                </p>
                {isCurrent && (
                  <motion.p 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[8px] text-emerald-500 font-medium mt-0.5"
                  >
                    Current Status
                  </motion.p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>("en");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"summary" | "address" | "payment">("summary");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"upi" | "card" | "netbanking" | "cod">("upi");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPaymentDetailsPrompt, setShowPaymentDetailsPrompt] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [allWithdrawals, setAllWithdrawals] = useState<Transaction[]>([]);
  const [paymentDetailsForm, setPaymentDetailsForm] = useState({
    upiId: "",
    bankName: "",
    accountNumber: "",
    ifscCode: ""
  });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"dashboard" | "marketplace" | "profile" | "auth" | "messages" | "cart" | "checkout" | "orders" | "wallet" | "admin" | "gmail">("auth");
  const [asyncError, setAsyncError] = useState<Error | null>(null);

  // Gmail pre-filled draft states
  const [gmailDraftTo, setGmailDraftTo] = useState("");
  const [gmailDraftSubject, setGmailDraftSubject] = useState("");
  const [gmailDraftBody, setGmailDraftBody] = useState("");

  const handleOpenGmailWithDraft = (to: string, subject: string, body?: string) => {
    setGmailDraftTo(to);
    setGmailDraftSubject(subject);
    setGmailDraftBody(body || "");
    navigateTo("gmail");
  };

  if (asyncError) throw asyncError;

  const t = getT(selectedLanguage);

  const catchFirestoreError = (err: any, op: OperationType, path: string | null) => {
    try {
      handleFirestoreError(err, op, path);
    } catch (e) {
      setAsyncError(e as Error);
    }
  };

  const handleLanguageSelect = async (code: LanguageCode) => {
    setSelectedLanguage(code);
    setShowLanguageModal(false);
    if (!user) return;
    
    // Only update firestore if the profile already exists
    if (profile) {
      try {
        await safeUpdateDoc(doc(db, "users", user.uid), {
          language: code
        });
        setProfile(prev => prev ? { ...prev, language: code } : null);
      } catch (err) {
        // handleFirestoreError is already called inside safeUpdateDoc
      }
    }
  };

  // Navigation history support
  const navigateTo = (newView: typeof view) => {
    if (newView !== view) {
      // Initialize state for the current view if it doesn't exist
      if (!window.history.state) {
        window.history.replaceState({ view }, "", "");
      }
      window.history.pushState({ view: newView }, "", "");
      setView(newView);
    }
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view) {
        setView(event.state.view);
      } else {
        // Fallback to dashboard if at the start of history
        if (auth.currentUser) {
          setView("dashboard");
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const [products, setProducts] = useState<Product[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [cropTypeFilter, setCropTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "price-low" | "price-high">("newest");
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [selectedCrop, setSelectedCrop] = useState("Wheat");
  const [userLocation, setUserLocation] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isLocating, setIsLocating] = useState(false);
  const predictionCache = useRef<Record<string, { unitPrice: number, totalPrice: number, confidence: number, sources: { title: string, url: string }[] }>>({});
  
  // AI States
  const [predicting, setPredicting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState<{ unitPrice: number, totalPrice: number, confidence: number, sources: { title: string, url: string }[] } | null>(null);
  const [quality, setQuality] = useState<{ grade: string; reason: string } | null>(null);

  // Message States
  const filteredAndSortedProducts = products
    .filter(p => {
      const matchesSearch = (p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.crop?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesGrade = gradeFilter === "all" || p.grade === gradeFilter;
      const matchesCropType = cropTypeFilter === "all" || p.crop === cropTypeFilter;
      const matchesLocation = !locationFilter || p.location?.toLowerCase().includes(locationFilter.toLowerCase());
      
      const price = p.price || 0;
      const matchesMinPrice = !minPrice || price >= parseFloat(minPrice);
      const matchesMaxPrice = !maxPrice || price <= parseFloat(maxPrice);
      
      return matchesSearch && matchesGrade && matchesCropType && matchesLocation && matchesMinPrice && matchesMaxPrice;
    })
    .sort((a, b) => {
      if (sortBy === "price-low") return (a.price || 0) - (b.price || 0);
      if (sortBy === "price-high") return (b.price || 0) - (a.price || 0);
      // Default: newest first
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });

  const [chatPartner, setChatPartner] = useState<{ uid: string, name: string, productId?: string, productName?: string } | null>(null);
  const [newMessageText, setNewMessageText] = useState("");

  // Form States
  const [newProduct, setNewProduct] = useState({ name: "", crop: "", price: "", location: "" });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [farmerOrders, setFarmerOrders] = useState<Order[]>([]);
  const [checkoutAddress, setCheckoutAddress] = useState("");
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cod">("cod");

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, "users", u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const profileData = docSnap.data() as UserProfile;
          setProfile(profileData);
          if (profileData.language) {
            setSelectedLanguage(profileData.language);
          } else {
            setShowLanguageModal(true);
          }
          // Initialize history with dashboard as the root
          window.history.replaceState({ view: "dashboard" }, "", "");
          setView("dashboard");
        } else {
          setShowLanguageModal(true); // Ask for language first
          navigateTo("profile"); // Setup profile
        }
      } else {
        setView("auth");
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "cart"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCartItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CartItem)));
    }, (err) => catchFirestoreError(err, OperationType.GET, `users/${user.uid}/cart`));
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "notifications"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    }, (err) => {
      if (err.message.includes("index")) {
        const q2 = query(collection(db, "notifications"), where("userId", "==", user.uid));
        onSnapshot(q2, (snapshot) => {
          setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        }, (err) => catchFirestoreError(err, OperationType.GET, `notifications`));
      }
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "transactions"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (err) => {
      if (err.message.includes("index")) {
        const q2 = query(collection(db, "transactions"), where("userId", "==", user.uid));
        onSnapshot(q2, (snapshot) => {
          setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        }, (err) => catchFirestoreError(err, OperationType.GET, `transactions`));
      }
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user || profile?.role !== "admin") return;
    const qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      setAllOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (err) => catchFirestoreError(err, OperationType.GET, "orders"));

    const qWithdrawals = query(collection(db, "transactions"), where("category", "==", "withdrawal"), orderBy("createdAt", "desc"));
    const unsubscribeWithdrawals = onSnapshot(qWithdrawals, (snapshot) => {
      setAllWithdrawals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (err) => catchFirestoreError(err, OperationType.GET, "transactions"));

    return () => {
      unsubscribeOrders();
      unsubscribeWithdrawals();
    };
  }, [user, profile]);

  useEffect(() => {
    if (user && profile?.role === "farmer" && !profile.paymentDetails) {
      setShowPaymentDetailsPrompt(true);
    }
  }, [user, profile]);

  useEffect(() => {
    if (!user) return;
    // Fetch orders where user is buyer
    const qBuyer = query(collection(db, "orders"), where("buyerId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubscribeBuyer = onSnapshot(qBuyer, (snapshot) => {
      setUserOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (err) => {
      if (err instanceof Error && err.message.includes("index")) {
        const q2 = query(collection(db, "orders"), where("buyerId", "==", user.uid));
        onSnapshot(q2, (snapshot) => {
          setUserOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        }, (err) => catchFirestoreError(err, OperationType.GET, "orders"));
      } else {
        catchFirestoreError(err, OperationType.GET, "orders");
      }
    });

    // Fetch orders where user is seller (Farmer)
    const qSeller = query(collection(db, "orders"), where("sellerIds", "array-contains", user.uid), orderBy("createdAt", "desc"));
    const unsubscribeSeller = onSnapshot(qSeller, (snapshot) => {
      setFarmerOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (err) => {
      if (err instanceof Error && err.message.includes("index")) {
        const q2 = query(collection(db, "orders"), where("sellerIds", "array-contains", user.uid));
        onSnapshot(q2, (snapshot) => {
          setFarmerOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        }, (err) => catchFirestoreError(err, OperationType.GET, "orders"));
      } else {
        catchFirestoreError(err, OperationType.GET, "orders");
      }
    });

    return () => {
      unsubscribeBuyer();
      unsubscribeSeller();
    };
  }, [user]);

  useEffect(() => {
    if (view === "marketplace" || view === "dashboard") {
      const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(items);
      }, (err) => catchFirestoreError(err, OperationType.LIST, "products"));
      return unsubscribe;
    }
  }, [view]);

  useEffect(() => {
    if (user && (view === "messages" || view === "marketplace" || view === "dashboard")) {
      const q = query(
        collection(db, "messages"), 
        or(where("senderId", "==", user.uid), where("receiverId", "==", user.uid)),
        orderBy("createdAt", "asc")
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
        setMessages(msgs);
      }, (err) => {
        // If index is missing, fallback to un-ordered query and sort in memory
        if (err.message.includes("index")) {
          const fallbackQ = query(
            collection(db, "messages"),
            or(where("senderId", "==", user.uid), where("receiverId", "==", user.uid))
          );
          onSnapshot(fallbackQ, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message))
              .sort((a: any, b: any) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
            setMessages(msgs);
          }, (fallbackErr) => catchFirestoreError(fallbackErr, OperationType.LIST, "messages"));
        } else {
          catchFirestoreError(err, OperationType.LIST, "messages");
        }
      });
      return unsubscribe;
    }
  }, [user, view]);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [demoOtpCode, setDemoOtpCode] = useState("");
  const [phoneName, setPhoneName] = useState("");
  const [otpRole, setOtpRole] = useState<"farmer" | "buyer">("farmer");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [emailDispatched, setEmailDispatched] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const loggedUser = await signInWithGoogle();
      if (!loggedUser) {
        setAuthError("Google Sign-In popup was closed before completing. If you are experiencing browser iframe restrictions, please use Mobile & Email OTP below.");
        return;
      }

      const docRef = doc(db, "users", loggedUser.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        const googleProfile: UserProfile = {
          name: loggedUser.displayName || (otpRole === "farmer" ? "Kisan User" : "Vyapari User"),
          phone: loggedUser.phoneNumber || phoneInput || "",
          email: loggedUser.email || undefined,
          role: otpRole,
          language: selectedLanguage,
          createdAt: serverTimestamp(),
          walletBalance: otpRole === "farmer" ? 5000 : 0
        };
        await safeSetDoc(docRef, googleProfile);
        setProfile(googleProfile);
      } else {
        const existing = docSnap.data() as UserProfile;
        setProfile(existing);
      }

      window.history.replaceState({ view: "dashboard" }, "", "");
      setView("dashboard");
    } catch (err: any) {
      console.warn("Google Sign-In error:", err);
      const code = err?.code || "";
      const msg = err?.message || "";
      if (code === "auth/popup-blocked" || msg.includes("popup-blocked")) {
        setAuthError("Sign-in popup was blocked by your browser. Please allow popups or use Mobile & Email OTP below.");
      } else if (code === "auth/unauthorized-domain" || msg.includes("unauthorized-domain")) {
        setAuthError("This preview domain is restricted for OAuth popups. Please use Mobile & Email OTP below.");
      } else {
        setAuthError("Google Sign-In was restricted in this embedded browser window. Please use Mobile & Email OTP below.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleQuickSignIn = async (role: "farmer" | "buyer") => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const u = await signInQuickAccess();
      if (u) {
        const docRef = doc(db, "users", u.uid);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          const quickProfile: UserProfile = {
            name: role === "farmer" ? "Ramesh Patel (Farmer)" : "Priya Sharma (Buyer)",
            phone: role === "farmer" ? "+91 98234 56789" : "+91 98765 43210",
            email: role === "farmer" ? "farmer.demo@agrinet.ai" : "buyer.demo@agrinet.ai",
            role: role,
            language: selectedLanguage,
            createdAt: serverTimestamp(),
            walletBalance: role === "farmer" ? 24500 : 0
          };
          await safeSetDoc(docRef, quickProfile);
          setProfile(quickProfile);
        }
        window.history.replaceState({ view: "dashboard" }, "", "");
        setView("dashboard");
      }
    } catch (err: any) {
      console.error("Quick sign-in error:", err);
      setAuthError("Quick sign-in could not be completed. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);
    setOtpSuccessMsg(null);

    const cleanPhone = phoneInput.trim();
    const cleanEmail = emailInput.trim().toLowerCase();

    if (!cleanPhone || cleanPhone.length < 7) {
      setAuthError("Please enter a valid mobile number (e.g., +91 98765 43210)");
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setAuthError("Please enter a valid Gmail / Email address where you'd like to receive your OTP code.");
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          email: cleanEmail,
          name: phoneName.trim(),
          role: otpRole
        })
      });
      const data = await res.json();
      if (!data.success) {
        setAuthError(data.error || "Failed to dispatch verification OTP. Please try again.");
        return;
      }
      setOtpSent(true);
      setEmailDispatched(Boolean(data.emailDispatched));
      setDemoOtpCode(data.otp || "123456");
      setResendCooldown(60);
      if (data.emailDispatched) {
        setOtpSuccessMsg(`Verification code sent to ${cleanEmail} via Gmail. Please check your inbox & spam folder.`);
      } else {
        setOtpSuccessMsg(data.message || `Verification code generated: ${data.otp}`);
      }
    } catch (e) {
      setAuthError("Failed to dispatch OTP. Please check your network connection.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = otpInput.trim();
    if (!cleanCode || cleanCode.length < 4) {
      setAuthError("Please enter the verification code sent to your email.");
      return;
    }
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneInput.trim(),
          email: emailInput.trim().toLowerCase(),
          otp: cleanCode
        })
      });
      const data = await res.json();
      if (!data.success) {
        setAuthError(data.error || "Invalid OTP code. Please check and try again.");
        setIsLoggingIn(false);
        return;
      }

      const u = await signInQuickAccess();
      if (u) {
        const docRef = doc(db, "users", u.uid);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          const profileData: UserProfile = {
            name: phoneName.trim() || (otpRole === "farmer" ? "Kisan User" : "Vyapari User"),
            phone: phoneInput.trim(),
            email: emailInput.trim().toLowerCase(),
            role: otpRole,
            language: selectedLanguage,
            createdAt: serverTimestamp(),
            walletBalance: otpRole === "farmer" ? 5000 : 0
          };
          await safeSetDoc(docRef, profileData);
          setProfile(profileData);
        } else {
          const existing = docSnap.data() as UserProfile;
          setProfile(existing);
        }
        window.history.replaceState({ view: "dashboard" }, "", "");
        setView("dashboard");
      }
    } catch (err: any) {
      console.error("OTP login verification error:", err);
      setAuthError("Failed to complete verification. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const enteredEmail = (formData.get("email") as string)?.trim() || user.email || emailInput || "";
    const data: UserProfile = {
      name: formData.get("name") as string,
      phone: formData.get("phone") as string,
      email: enteredEmail || undefined,
      role: formData.get("role") as any,
      language: selectedLanguage,
      createdAt: serverTimestamp(),
    };
    try {
      await safeSetDoc(doc(db, "users", user.uid), data);
      setProfile(data);
      navigateTo("dashboard");
    } catch (err) {
      // handleFirestoreError is already called inside safeSetDoc
    }
  };

  const safeUpdateDoc = async (docRef: any, data: any, operationType: OperationType = OperationType.UPDATE) => {
    try {
      await updateDoc(docRef, data);
    } catch (err) {
      catchFirestoreError(err, operationType, docRef.path);
    }
  };

  const safeAddDoc = async (colRef: any, data: any, operationType: OperationType = OperationType.CREATE) => {
    try {
      return await addDoc(colRef, data);
    } catch (err) {
      catchFirestoreError(err, operationType, colRef.path);
    }
  };

  const safeSetDoc = async (docRef: any, data: any, operationType: OperationType = OperationType.WRITE) => {
    try {
      await setDoc(docRef, data);
    } catch (err) {
      catchFirestoreError(err, operationType, docRef.path);
    }
  };

  const safeDeleteDoc = async (docRef: any, operationType: OperationType = OperationType.DELETE) => {
    try {
      await deleteDoc(docRef);
    } catch (err) {
      catchFirestoreError(err, operationType, docRef.path);
    }
  };

  const addToCart = async (product: Product) => {
    if (!user) return;
    try {
      const existingItem = cartItems.find(item => item.productId === product.id);
      if (existingItem) {
        const cartRef = doc(db, "users", user.uid, "cart", existingItem.id);
        await safeUpdateDoc(cartRef, { quantity: existingItem.quantity + 1 });
      } else {
        const cartRef = collection(db, "users", user.uid, "cart");
        await safeAddDoc(cartRef, {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          imageUrl: product.imageUrl || "",
          sellerId: product.authorUid,
          sellerName: product.authorName
        });
      }
      navigateTo("cart");
    } catch (err) {
      catchFirestoreError(err, OperationType.WRITE, `users/${user.uid}/cart`);
    }
  };

  const removeFromCart = async (itemId: string) => {
    if (!user) return;
    try {
      const cartRef = doc(db, "users", user.uid, "cart", itemId);
      await safeDeleteDoc(cartRef);
    } catch (err) {
      // handleFirestoreError is already called inside safeDeleteDoc
    }
  };

  const sendNotification = async (userId: string, title: string, message: string, type: "order" | "payment" | "system", orderId?: string) => {
    try {
      await safeAddDoc(collection(db, "notifications"), {
        userId,
        title,
        message,
        type,
        isRead: false,
        createdAt: serverTimestamp(),
        orderId
      });
    } catch (err) {
      // handleFirestoreError is already called inside safeAddDoc
    }
  };

  const handlePlaceOrder = async () => {
    if (!user || !profile || cartItems.length === 0) return;

    if (!checkoutAddress.trim() || !checkoutPhone.trim()) {
      setCheckoutStep("address");
      return;
    }

    const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const sellerIds = Array.from(new Set(cartItems.map(item => item.sellerId)));
    
    const orderData: any = {
      buyerId: user.uid,
      buyerName: profile.name,
      items: cartItems,
      totalAmount,
      status: "pending",
      paymentMethod: selectedPaymentMethod,
      paymentStatus: "pending",
      createdAt: serverTimestamp(),
      address: checkoutAddress,
      phone: checkoutPhone,
      sellerIds
    };

    setIsProcessingPayment(true);

    try {
      if (selectedPaymentMethod === "cod") {
        // COD Flow
        const orderRef = await safeAddDoc(collection(db, "orders"), orderData);
        if (orderRef) await finalizeOrder(orderRef.id, sellerIds);
      } else {
        // Online Payment Flow (Razorpay)
        const response = await fetch("/api/create-razorpay-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: totalAmount,
            currency: "INR",
            receipt: `order_${Date.now()}`
          })
        });
        
        if (!response.ok) throw new Error("Failed to create Razorpay order");
        const rzpOrder = await response.json();

        const options = {
          key: (import.meta as any).env.VITE_RAZORPAY_KEY_ID || "rzp_test_mock",
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
          name: "AgriNet",
          description: "Crop Purchase",
          order_id: rzpOrder.id,
          handler: async (response: any) => {
            try {
              const verifyRes = await fetch("/api/verify-razorpay-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                })
              });
              const verifyData = await verifyRes.json();
              if (verifyData.success) {
                // Payment verified, now create order in Firestore
                const finalOrderData = {
                  ...orderData,
                  paymentStatus: "paid",
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id
                };
                const orderRef = await safeAddDoc(collection(db, "orders"), finalOrderData);
                if (orderRef) await finalizeOrder(orderRef.id, sellerIds);
              } else {
                alert(t('payment_verification_failed_support'));
              }
            } catch (err) {
              console.error("Verification error:", err);
              alert(t('payment_error_occurred'));
            }
          },
          prefill: {
            name: profile.name,
            contact: checkoutPhone,
            email: user.email
          },
          theme: { color: "#10b981" },
          modal: {
            ondismiss: () => setIsProcessingPayment(false)
          }
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    } catch (err) {
      console.error("Order error:", err);
      catchFirestoreError(err, OperationType.CREATE, "orders");
      setIsProcessingPayment(false);
    }
  };

  const handleManualPayment = async (orderId: string) => {
    if (!user || !profile) return;
    
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    setIsProcessingPayment(true);
    try {
      const response = await fetch("/api/create-razorpay-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: order.totalAmount,
          currency: "INR",
          receipt: orderId
        })
      });
      
      if (!response.ok) throw new Error("Failed to create Razorpay order");
      const rzpOrder = await response.json();

      const options = {
        key: (import.meta as any).env.VITE_RAZORPAY_KEY_ID || "rzp_test_mock",
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        name: "AgriNet",
        description: "Crop Purchase",
        order_id: rzpOrder.id,
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch("/api/verify-razorpay-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              await safeUpdateDoc(doc(db, "orders", orderId), {
                paymentStatus: "paid",
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id
              });
              setShowPaymentSelector(false);
              alert(t('payment_successful'));
            } else {
              alert(t('payment_verification_failed'));
            }
          } catch (err) {
            console.error("Verification error:", err);
            alert(t('payment_error_occurred'));
          }
        },
        prefill: {
          name: profile.name,
          contact: order.phone,
          email: user.email
        },
        theme: { color: "#10b981" },
        modal: {
          ondismiss: () => setIsProcessingPayment(false)
        }
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Payment error:", err);
      alert(t('failed_initiate_payment'));
      setIsProcessingPayment(false);
    }
  };

  const finalizeOrder = async (orderId: string, sellerIds: string[]) => {
    if (!user || !profile) return;
    
    // Clear cart
    for (const item of cartItems) {
      try {
        await safeDeleteDoc(doc(db, "users", user.uid, "cart", item.id));
      } catch (err) {
        // handleFirestoreError is already called inside safeDeleteDoc
      }
    }

    // Notify sellers
    for (const sellerId of sellerIds) {
      await sendNotification(
        sellerId,
        t('new_order_received'),
        `${profile.name} has placed an order for your items.`,
        "order",
        orderId
      );
    }
    
    setShowOrderSuccess(true);
    setTimeout(() => {
      setShowOrderSuccess(false);
      navigateTo("orders");
      setCheckoutStep("summary");
    }, 3000);
  };

  const handlePaymentComplete = async (method: string) => {
    if (!lastOrderId || !user) return;
    try {
      const orderRef = doc(db, "orders", lastOrderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) return;
      const orderData = orderSnap.data() as Order;

      try {
        await safeUpdateDoc(orderRef, {
          paymentStatus: "paid",
          paymentId: `PAY-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          paymentMethodUsed: method
        });
      } catch (err) {
        // handleFirestoreError is already called inside safeUpdateDoc
      }

      // 2. Calculate amounts per seller
      const totalAmount = orderData.totalAmount;
      const commissionRate = 0.1; // 10%
      
      const sellerTotals: { [key: string]: number } = {};
      orderData.items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        sellerTotals[item.sellerId] = (sellerTotals[item.sellerId] || 0) + itemTotal;
      });

      for (const sellerId in sellerTotals) {
        const totalForSeller = sellerTotals[sellerId];
        const commissionForSeller = totalForSeller * commissionRate;
        const amountToCredit = totalForSeller - commissionForSeller;

        const sellerRef = doc(db, "users", sellerId);
        const sellerSnap = await getDoc(sellerRef);
        const currentBalance = sellerSnap.data()?.walletBalance || 0;

        try {
          await safeUpdateDoc(sellerRef, {
            walletBalance: currentBalance + amountToCredit
          });
        } catch (err) {
          // handleFirestoreError is already called inside safeUpdateDoc
        }

        // Create sale transaction for seller
        try {
          await safeAddDoc(collection(db, "transactions"), {
            userId: sellerId,
            type: "credit",
            category: "sale",
            amount: amountToCredit,
            status: "completed",
            description: `Sale from order #${lastOrderId.slice(0, 8)}`,
            orderId: lastOrderId,
            createdAt: serverTimestamp()
          });
        } catch (err) {
          // handleFirestoreError is already called inside safeAddDoc
        }

        // Create commission transaction (for tracking)
        try {
          await safeAddDoc(collection(db, "transactions"), {
            userId: "admin", // Platform earnings
            type: "credit",
            category: "commission",
            amount: commissionForSeller,
            status: "completed",
            description: `Commission from order #${lastOrderId.slice(0, 8)} (Seller: ${sellerId})`,
            orderId: lastOrderId,
            createdAt: serverTimestamp()
          });
        } catch (err) {
          // handleFirestoreError is already called inside safeAddDoc
        }

        // Notify seller
        await sendNotification(
          sellerId,
          t('payment_received'),
          `Payment for order #${lastOrderId.slice(0, 8)} confirmed. ₹${amountToCredit.toFixed(2)} added to wallet.`,
          "payment",
          lastOrderId
        );
      }

      setShowPaymentSelector(false);
      setShowOrderSuccess(true);
      setTimeout(() => {
        setShowOrderSuccess(false);
        navigateTo("orders");
      }, 3000);
    } catch (err) {
      catchFirestoreError(err, OperationType.UPDATE, "orders");
    }
  };

  const handleWithdrawalRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !withdrawAmount) return;
    const amount = parseFloat(withdrawAmount);
    if (amount <= 0 || amount > (profile.walletBalance || 0)) {
      alert(t('invalid_withdrawal_amount'));
      return;
    }

    try {
      await safeAddDoc(collection(db, "transactions"), {
        userId: user.uid,
        type: "debit",
        category: "withdrawal",
        amount: amount,
        status: "pending",
        description: `Withdrawal request to ${profile.paymentDetails?.upiId || "bank account"}`,
        createdAt: serverTimestamp()
      });

      await safeUpdateDoc(doc(db, "users", user.uid), {
        walletBalance: (profile.walletBalance || 0) - amount
      });

      setShowWithdrawalModal(false);
      setWithdrawAmount("");
      alert(t('withdrawal_submitted'));
    } catch (err) {
      catchFirestoreError(err, OperationType.CREATE, "transactions");
    }
  };

  const handleApproveWithdrawal = async (transactionId: string) => {
    try {
      await safeUpdateDoc(doc(db, "transactions", transactionId), {
        status: "completed"
      });
      
      const tx = allWithdrawals.find(t => t.id === transactionId);
      if (tx) {
        await sendNotification(
          tx.userId,
          t('withdrawal_approved'),
          `Your withdrawal of ₹${tx.amount} has been processed.`,
          "payment"
        );
      }
    } catch (err) {
      catchFirestoreError(err, OperationType.UPDATE, `transactions/${transactionId}`);
    }
  };

  const updatePaymentDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const userRef = doc(db, "users", user.uid);
      await safeUpdateDoc(userRef, {
        paymentDetails: paymentDetailsForm
      });
      setProfile(prev => prev ? { ...prev, paymentDetails: paymentDetailsForm } : null);
      setShowPaymentDetailsPrompt(false);
      alert(t('payment_details_updated'));
    } catch (err) {
      catchFirestoreError(err, OperationType.UPDATE, "users");
    }
  };

  useEffect(() => {
    setPrediction(null);
  }, [selectedCrop, userLocation, quantity]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      alert(t('geolocation_not_supported'));
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const currentLanguageName = languages.find(l => l.code === selectedLanguage)?.name || t('english');
          const locationName = await getLocationName(latitude, longitude, currentLanguageName);
          setUserLocation(locationName);
        } catch (error) {
          console.error("Error getting location name:", error);
          setUserLocation(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setIsLocating(false);
        alert(t('unable_retrieve_location'));
      }
    );
  };

  const handlePredictPrice = async (cropOverride?: string, quantityOverride?: number) => {
    setPredicting(true);
    const cropToPredict = cropOverride || selectedCrop;
    const qtyToPredict = quantityOverride || quantity;
    const cacheKey = `${cropToPredict}-${userLocation}-${qtyToPredict}`;

    // Check cache first
    if (predictionCache.current[cacheKey]) {
      const cachedData = predictionCache.current[cacheKey];
      setPrediction(cachedData);
      speak(t('price_prediction_result', { qty: qtyToPredict, crop: cropToPredict, location: userLocation || t('your_area'), price: cachedData.totalPrice }));
      setPredicting(false);
      return;
    }

    try {
      const currentLanguageName = languages.find(l => l.code === selectedLanguage)?.name || t('english');
      const data = await predictPrice(15, 120, 5, cropToPredict, userLocation, qtyToPredict, currentLanguageName);
      if (data && data.unitPrice !== undefined) {
        setPrediction(data);
        predictionCache.current[cacheKey] = data;
        speak(t('price_prediction_result', { qty: qtyToPredict, crop: cropToPredict, location: userLocation || t('your_area'), price: data.totalPrice }) + " " + t('price_prediction_confidence', { confidence: Math.round(data.confidence * 100) }));
      } else {
        throw new Error("Invalid response from AI");
      }
    } catch (err) {
      console.error(err);
      alert(t('failed_predict_price'));
    } finally {
      setPredicting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeQuality = async () => {
    if (!imagePreview) return;
    setAnalyzing(true);
    try {
      const currentLanguageName = languages.find(l => l.code === selectedLanguage)?.name || t('english');
      const data = await analyzeQuality(imagePreview, currentLanguageName);
      if (data && data.grade) {
        setQuality(data);
        speak(t('quality_analysis_result', { grade: data.grade, reason: data.reason || "" }));
      } else {
        throw new Error("Invalid analysis result");
      }
    } catch (err) {
      console.error(err);
      alert(t('failed_analyze_quality'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    const data = {
      ...newProduct,
      price: parseFloat(newProduct.price),
      authorUid: user.uid,
      authorName: profile.name,
      createdAt: serverTimestamp(),
      grade: quality?.grade || t('na'),
      imageUrl: imagePreview || ""
    };
    try {
      await safeAddDoc(collection(db, "products"), data);
      setNewProduct({ name: "", crop: "", price: "", location: "" });
      setImagePreview(null);
      setQuality(null);
      alert(t('product_listed_success'));
    } catch (err) {
      // handleFirestoreError is already called inside safeAddDoc
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !profile || !chatPartner || !newMessageText.trim()) return;

    const messageData = {
      senderId: user.uid,
      senderName: profile.name,
      receiverId: chatPartner.uid,
      productId: chatPartner.productId || "",
      productName: chatPartner.productName || "",
      text: newMessageText.trim(),
      createdAt: serverTimestamp()
    };

    try {
      await safeAddDoc(collection(db, "messages"), messageData);
      setNewMessageText("");
    } catch (err) {
      // handleFirestoreError is already called inside safeAddDoc
    }
  };

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const langMapping: Record<LanguageCode, string> = {
      en: "en-US",
      hi: "hi-IN",
      mr: "mr-IN",
      te: "te-IN",
      ta: "ta-IN",
      kn: "kn-IN",
      bn: "bn-IN",
      gu: "gu-IN"
    };
    utterance.lang = langMapping[selectedLanguage];
    window.speechSynthesis.speak(utterance);
  };

  const handleVoiceAssistant = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert(t('speech_not_supported'));
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    const langMapping: Record<LanguageCode, string> = {
      en: "en-US",
      hi: "hi-IN",
      mr: "mr-IN",
      te: "te-IN",
      ta: "ta-IN",
      kn: "kn-IN",
      bn: "bn-IN",
      gu: "gu-IN"
    };
    recognition.lang = langMapping[selectedLanguage];
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (!navigator.onLine) {
        recognition.stop();
        speak(t('offline_message'));
        return;
      }
      setIsListening(true);
      setVoiceTranscript("");
      speak(t('listening_message'));
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setVoiceTranscript(transcript);
      setIsListening(false);
      setIsProcessingVoice(true);
      
      try {
        if (!navigator.onLine) {
          throw new Error("Network error: Offline");
        }
        // Process with Gemini
        const aiResult = await processVoiceCommand(transcript, { 
          userRole: profile?.role, 
          currentView: view,
          productCount: products.length,
          selectedCrop,
          userLocation
        }, languages.find(l => l.code === selectedLanguage)?.name || t('english'));

        speak(aiResult.text);

        // Execute actions
        if (aiResult.action === "NAVIGATE_DASHBOARD") navigateTo("dashboard");
        if (aiResult.action === "NAVIGATE_MARKETPLACE") navigateTo("marketplace");
        if (aiResult.action === "NAVIGATE_PROFILE") navigateTo("profile");
        if (aiResult.action === "NAVIGATE_MESSAGES") navigateTo("messages");
        if (aiResult.action === "NAVIGATE_GMAIL" || transcript.toLowerCase().includes("gmail") || transcript.toLowerCase().includes("inbox")) navigateTo("gmail");
        if (aiResult.action === "PREDICT_PRICE") {
          if (aiResult.crop) {
            setSelectedCrop(aiResult.crop);
            if (aiResult.quantity) {
              setQuantity(aiResult.quantity);
              handlePredictPrice(aiResult.crop, aiResult.quantity);
            } else {
              handlePredictPrice(aiResult.crop);
            }
          } else {
            handlePredictPrice();
          }
        }
        if (aiResult.action === "ANALYZE_QUALITY") navigateTo("dashboard");
      } catch (err) {
        console.error(err);
        if (!navigator.onLine) {
          speak(t('offline_request_error'));
        } else {
          speak(t('processing_error'));
        }
      } finally {
        setIsProcessingVoice(false);
        setTimeout(() => setVoiceTranscript(""), 5000);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      
      if (event.error === 'network') {
        speak(t('speech_connection_error'));
      } else if (event.error === 'not-allowed') {
        speak(t('microphone_denied'));
      } else if (event.error === 'no-speech') {
        speak(t('no_speech_detected'));
      } else {
        speak(t('speech_not_clear'));
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-emerald-50">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <AnimatePresence>
        {showLanguageModal && (
          <motion.div 
            key="language-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md"
            >
              <LanguageModalContent onSelect={handleLanguageSelect} t={t} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Navigation */}
      <AnimatePresence>
        {user && profile && (
          <motion.nav 
            key="main-nav"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="bg-white border-b border-slate-100 sticky top-0 z-50"
          >
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {view !== "dashboard" && (
                  <button 
                    onClick={() => window.history.back()} 
                    className="p-2 -ml-2 hover:bg-slate-100 rounded-full text-slate-500 flex items-center gap-1"
                    aria-label={t('go_back')}
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="text-sm font-medium hidden sm:inline">{t('back')}</span>
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                    <Leaf className="text-white w-6 h-6" />
                  </div>
                  <span className="text-xl font-bold tracking-tight text-emerald-900">{t('agrinet_ai')}</span>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-6">
                <button onClick={() => navigateTo("dashboard")} className={cn("text-sm font-medium", view === "dashboard" ? "text-emerald-600" : "text-slate-500 hover:text-emerald-600")}>{t('dashboard')}</button>
                <button onClick={() => navigateTo("marketplace")} className={cn("text-sm font-medium", view === "marketplace" ? "text-emerald-600" : "text-slate-500 hover:text-emerald-600")}>{t('marketplace')}</button>
                <button onClick={() => navigateTo("messages")} className={cn("text-sm font-medium", view === "messages" ? "text-emerald-600" : "text-slate-500 hover:text-emerald-600")}>{t('messages')}</button>
                <button onClick={() => navigateTo("gmail")} className={cn("text-sm font-medium flex items-center gap-1.5 transition-colors", view === "gmail" ? "text-emerald-600 font-bold" : "text-slate-500 hover:text-emerald-600")}>
                  <Mail className="w-4 h-4" />
                  <span>{t('gmail') || "Gmail"}</span>
                </button>
                {profile?.role === "buyer" && (
                  <button onClick={() => navigateTo("orders")} className={cn("text-sm font-medium", view === "orders" ? "text-emerald-600" : "text-slate-500 hover:text-emerald-600")}>{t('orders')}</button>
                )}
                {profile?.role === "farmer" && (
                  <button onClick={() => navigateTo("wallet")} className={cn("text-sm font-medium", view === "wallet" ? "text-emerald-600" : "text-slate-500 hover:text-emerald-600")}>{t('wallet')}</button>
                )}
                {profile?.role === "admin" && (
                  <button onClick={() => navigateTo("admin")} className={cn("text-sm font-medium", view === "admin" ? "text-emerald-600" : "text-slate-500 hover:text-emerald-600")}>{t('admin')}</button>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)} 
                    className="relative p-2 hover:bg-slate-100 rounded-full text-slate-500"
                  >
                    <Bell className="w-5 h-5" />
                    {notifications.filter(n => !n.isRead).length > 0 && (
                      <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white">
                        {notifications.filter(n => !n.isRead).length}
                      </span>
                    )}
                  </button>
                </div>
                {profile?.role === "buyer" && (
                    <button onClick={() => navigateTo("cart")} className="relative p-2 hover:bg-slate-100 rounded-full text-slate-500">
                      <ShoppingCart className="w-5 h-5" />
                      {cartItems.length > 0 && (
                        <span className="absolute top-0 right-0 w-4 h-4 bg-emerald-600 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white">
                          {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
                        </span>
                      )}
                    </button>
                  )}
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold">{profile?.name || t('user_label')}</p>
                    <p className="text-xs text-slate-500 capitalize">{profile?.role || t('member_label')}</p>
                  </div>
                  <button onClick={() => signOut(auth)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {view === "auth" && (
            <motion.div 
              key="auth"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto mt-12 mb-12"
            >
              <Card className="p-8 text-center space-y-6 shadow-xl border-slate-200">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                  <Leaf className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('welcome_to_agrinet')}</h1>
                  <p className="text-slate-500 text-sm mt-1">Smart Agriculture Platform for Farmers & Buyers</p>
                </div>

                {authError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs text-left flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                {otpSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs text-left flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{otpSuccessMsg}</span>
                  </div>
                )}

                {/* Role Switcher */}
                <div className="text-left">
                  <label className="text-xs font-semibold text-slate-700 block mb-2">I am signing in as:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOtpRole("farmer")}
                      className={cn(
                        "p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer",
                        otpRole === "farmer"
                          ? "border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      <span className="text-xl">🌾</span>
                      <span className="text-xs font-bold text-slate-900">Farmer (Kisan)</span>
                      <span className="text-[10px] text-slate-500">Sell harvests & predict rates</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOtpRole("buyer")}
                      className={cn(
                        "p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer",
                        otpRole === "buyer"
                          ? "border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      <span className="text-xl">🛒</span>
                      <span className="text-xs font-bold text-slate-900">Buyer (Vyapari)</span>
                      <span className="text-[10px] text-slate-500">Source fresh produce direct</span>
                    </button>
                  </div>
                </div>

                {!otpSent ? (
                  /* Step 1: Mobile & Email Input */
                  <form onSubmit={handleSendOtp} className="space-y-4 text-left">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Mobile Number <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <Input
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          className="pl-9 text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Gmail / Email Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <Input
                          type="email"
                          placeholder="yourname@gmail.com"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          className="pl-9 text-sm"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        <span>✉️</span> We dispatch a 6-digit verification OTP to this email via Gmail.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Your Full Name <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. Ramesh Patel"
                        value={phoneName}
                        onChange={(e) => setPhoneName(e.target.value)}
                        className="text-sm"
                      />
                    </div>

                    <Button 
                      type="submit" 
                      disabled={isSendingOtp} 
                      className="w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                    >
                      {isSendingOtp ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          Sending OTP to Gmail...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 mr-1" />
                          Send Verification OTP
                        </>
                      )}
                    </Button>
                  </form>
                ) : (
                  /* Step 2: OTP Verification */
                  <form onSubmit={handleVerifyOtp} className="space-y-4 text-left">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs text-slate-700 font-medium">
                        <span>Dispatched to:</span>
                        <span className="font-bold text-emerald-800 truncate max-w-[200px]">{emailInput}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Mobile:</span>
                        <span>{phoneInput}</span>
                      </div>
                      {demoOtpCode && (
                        <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-emerald-700 bg-emerald-50/70 p-1.5 rounded">
                          <span>Preview / Master Code:</span>
                          <span className="font-mono font-bold text-sm tracking-wider text-emerald-900">{demoOtpCode}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Enter 6-Digit Verification Code
                      </label>
                      <Input
                        type="text"
                        maxLength={6}
                        placeholder="123456"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        className="text-center font-mono text-xl tracking-[0.3em] font-bold py-3"
                        required
                        autoFocus
                      />
                    </div>

                    <Button 
                      type="submit" 
                      disabled={isLoggingIn} 
                      className="w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                    >
                      {isLoggingIn ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          Verifying & Signing In...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Verify & Enter AgriNet
                        </>
                      )}
                    </Button>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setOtpInput("");
                          setAuthError(null);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                      >
                        Change Mobile / Email
                      </button>

                      <button
                        type="button"
                        disabled={resendCooldown > 0 || isSendingOtp}
                        onClick={() => handleSendOtp()}
                        className={cn(
                          "text-xs font-medium cursor-pointer",
                          resendCooldown > 0 ? "text-slate-400" : "text-emerald-700 hover:text-emerald-800 underline"
                        )}
                      >
                        {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend OTP Code"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Secondary Fast Access */}
                <div className="pt-2">
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
                    <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                      <span className="bg-white px-3 text-slate-400">Or Instant 1-Click Demo</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickSignIn("farmer")}
                      disabled={isLoggingIn}
                      className="p-2.5 border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer text-xs font-semibold text-emerald-900"
                    >
                      <span>🌾</span>
                      <span>Demo Farmer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSignIn("buyer")}
                      disabled={isLoggingIn}
                      className="p-2.5 border border-blue-200 bg-blue-50/60 hover:bg-blue-100 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer text-xs font-semibold text-blue-900"
                    >
                      <span>🛒</span>
                      <span>Demo Buyer</span>
                    </button>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-[11px] text-slate-500 mb-2">Or continue with Google & access Gmail features:</p>
                    <button
                      type="button"
                      onClick={handleLogin}
                      disabled={isLoggingIn}
                      className="gsi-material-button w-full shadow-xs"
                    >
                      <div className="gsi-material-button-state"></div>
                      <div className="gsi-material-button-content-wrapper">
                        <div className="gsi-material-button-icon">
                          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                            <path fill="none" d="M0 0h48v48H0z"></path>
                          </svg>
                        </div>
                        <span className="gsi-material-button-contents text-slate-800 text-xs font-semibold">
                          {isLoggingIn ? "Signing in with Google..." : "Sign in with Google & Gmail"}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {view === "profile" && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="max-w-md mx-auto"
            >
              <Card className="p-8 space-y-6">
                <h2 className="text-2xl font-bold">{t('complete_profile')}</h2>
                <form onSubmit={handleCreateProfile} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('full_name')}</label>
                    <Input name="name" required placeholder={t('name_placeholder')} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('phone_number')}</label>
                    <Input name="phone" required defaultValue={phoneInput} placeholder={t('phone_placeholder')} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Email Address (Gmail)</label>
                    <Input name="email" type="email" defaultValue={user.email || emailInput} placeholder="yourname@gmail.com" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('i_am_a')}</label>
                    <select name="role" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="farmer">{t('farmer')}</option>
                      <option value="buyer">{t('buyer')}</option>
                    </select>
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <label className="text-sm font-medium mb-3 block">{t('language_settings')}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {languages.map(lang => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => handleLanguageSelect(lang.code as LanguageCode)}
                          className={cn(
                            "px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                            selectedLanguage === lang.code 
                              ? "border-emerald-600 bg-emerald-50 text-emerald-700" 
                              : "border-slate-200 hover:border-emerald-200"
                          )}
                        >
                          {lang.native}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full">{t('create_profile')}</Button>
                </form>
              </Card>
            </motion.div>
          )}

          {view === "dashboard" && profile && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* AI Price Prediction Card */}
                <Card className="p-6 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-white/20 rounded-xl"><TrendingUp className="w-6 h-6" /></div>
                    <span className="text-xs font-bold uppercase tracking-wider opacity-80">{t('ai_insights')}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t('price_prediction')}</h3>
                  <p className="text-emerald-50 opacity-90 text-sm mb-4">Get real-time expected market prices using our AI model.</p>
                  
                  <div className="mb-4">
                    <label className="text-[10px] uppercase font-bold opacity-70 mb-1 block">{t('location')}</label>
                    <div className="flex gap-2">
                      <Input 
                        value={userLocation}
                        onChange={(e) => setUserLocation(e.target.value)}
                        placeholder={t('location_placeholder')}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-9"
                      />
                      <Button 
                        variant="secondary" 
                        className="h-9 w-9 shrink-0 p-0"
                        onClick={detectLocation}
                        disabled={isLocating}
                      >
                        {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold opacity-70 mb-1 block">{t('crop_name')}</label>
                      <select 
                        value={selectedCrop} 
                        onChange={(e) => setSelectedCrop(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                      >
                        {!["Wheat", "Soybean", "Rice", "Corn", "Cotton"].includes(selectedCrop) && (
                          <option value={selectedCrop} className="text-slate-900">{selectedCrop}</option>
                        )}
                        <option value="Wheat" className="text-slate-900">{t('wheat')}</option>
                        <option value="Soybean" className="text-slate-900">{t('soybean')}</option>
                        <option value="Rice" className="text-slate-900">{t('rice')}</option>
                        <option value="Corn" className="text-slate-900">{t('corn')}</option>
                        <option value="Cotton" className="text-slate-900">{t('cotton')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold opacity-70 mb-1 block">{t('quantity')}</label>
                      <Input 
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-9"
                      />
                    </div>
                  </div>

                  {prediction ? (
                    <div className="bg-white/10 p-4 rounded-xl mb-4 space-y-2">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs uppercase opacity-70">{t('total_for')} {quantity}kg {selectedCrop}</p>
                          <p className="text-3xl font-bold">₹{prediction.totalPrice}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase opacity-70">{t('unit_price')}</p>
                          <p className="text-sm font-medium">₹{prediction.unitPrice}/kg</p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold opacity-70">{t('ai_confidence')}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-400" 
                              style={{ width: `${prediction.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold">{Math.round(prediction.confidence * 100)}%</span>
                        </div>
                      </div>
                      {prediction.sources && prediction.sources.length > 0 && (
                        <div className="pt-2 border-t border-white/10">
                          <p className="text-[10px] uppercase font-bold opacity-70 mb-1">{t('sources_google_search')}</p>
                          <div className="flex flex-col gap-1">
                            {prediction.sources.slice(0, 3).map((source, idx) => (
                              <a 
                                key={idx} 
                                href={source.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1.5 rounded flex items-center justify-between gap-2 transition-colors w-full group"
                                title={source.title}
                              >
                                <span className="truncate flex-1">{source.title || `${t('source')} ${idx + 1}`}</span>
                                <ExternalLink className="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                  <Button 
                    variant="secondary" 
                    className="w-full" 
                    onClick={() => handlePredictPrice()}
                    disabled={predicting || !userLocation}
                  >
                    {predicting ? <Loader2 className="animate-spin w-5 h-5" /> : userLocation ? `${t('predict')} ${selectedCrop} ${t('price_label')}` : t('enter_location_predict')}
                  </Button>
                </Card>

                {/* Quality Analysis Card */}
                <Card className="p-6 bg-white">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-amber-100 rounded-xl text-amber-600"><Camera className="w-6 h-6" /></div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('computer_vision')}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t('quality_check')}</h3>
                  <p className="text-slate-500 text-sm mb-6">{t('quality_check_desc')}</p>
                  
                  <div className="space-y-4">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="crop-upload" />
                    <label htmlFor="crop-upload" className="block w-full p-4 border-2 border-dashed border-slate-200 rounded-xl text-center cursor-pointer hover:border-emerald-500 transition-all">
                      {imagePreview ? (
                        <img src={imagePreview} className="h-32 mx-auto rounded-lg object-cover" />
                      ) : (
                        <div className="text-slate-400">
                          <Plus className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-xs">{t('click_to_upload')}</p>
                        </div>
                      )}
                    </label>
                    {quality && (
                      <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                        <p className="text-sm font-bold text-emerald-700">{quality.grade}</p>
                        <p className="text-xs text-emerald-600">{quality.reason}</p>
                      </div>
                    )}
                    <Button 
                      className="w-full" 
                      onClick={handleAnalyzeQuality}
                      disabled={!imagePreview || analyzing}
                    >
                      {analyzing ? <Loader2 className="animate-spin w-5 h-5" /> : t('analyze_quality_btn')}
                    </Button>
                  </div>
                </Card>

                {/* Wallet & Stats Card */}
                <Card className="p-6 bg-white">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-100 rounded-xl text-blue-600"><Wallet className="w-6 h-6" /></div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('earnings')}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t('my_wallet')}</h3>
                  <div className="space-y-4 mt-4">
                    <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                      <span className="text-sm text-emerald-700 font-medium">{t('available_balance')}</span>
                      <span className="font-bold text-emerald-700 text-lg">₹{profile?.walletBalance?.toFixed(2) || "0.00"}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-600">{t('active_products')}</span>
                      <span className="font-bold">{products.filter(p => p.authorUid === user?.uid).length}</span>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => navigateTo("wallet")}>
                      {t('manage_wallet')} <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Gmail Agri-Hub Quick Banner */}
              <Card className="p-5 bg-gradient-to-r from-red-500/10 via-amber-500/10 to-emerald-500/10 border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white text-red-600 shadow-sm flex items-center justify-center">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-slate-900">Gmail Agricultural Integration</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Ready</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Send official trade inquiries, dispatch orders, and sync mandi emails directly from your Gmail.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button 
                      variant="outline" 
                      className="bg-white hover:bg-slate-50 text-xs font-semibold"
                      onClick={() => handleOpenGmailWithDraft("", "🌾 Mandi Crop Inquiry - AgriNet AI", "<p>Hello,</p><p>Inquiring about current market rates and crop availability.</p>")}
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Quick Email
                    </Button>
                    <Button 
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                      onClick={() => navigateTo("gmail")}
                    >
                      <span>Open Gmail Hub</span>
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>

              {profile.role === "farmer" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Add Product Form */}
                  <Card className="p-8">
                    <h3 className="text-2xl font-bold mb-6">{t('list_new_product')}</h3>
                    <form onSubmit={handleAddProduct} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-1 block">{t('product_name')}</label>
                          <Input value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} required placeholder={t('fresh_wheat_placeholder')} />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">{t('crop_type')}</label>
                          <Input value={newProduct.crop} onChange={e => setNewProduct({...newProduct, crop: e.target.value})} required placeholder={t('wheat_placeholder')} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-1 block">{t('price_placeholder_label')}</label>
                          <Input type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} required placeholder={t('price_placeholder_value')} />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">{t('location')}</label>
                          <Input value={newProduct.location} onChange={e => setNewProduct({...newProduct, location: e.target.value})} required placeholder={t('location_placeholder')} />
                        </div>
                      </div>
                      <Button type="submit" className="w-full py-4">{t('list_product_btn')}</Button>
                    </form>
                  </Card>

                  {/* Recent Activity & Orders */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold">{t('manage_orders')}</h3>
                      {farmerOrders.length === 0 ? (
                        <Card className="p-8 text-center text-slate-400 italic text-sm">
                          {t('no_orders_received')}
                        </Card>
                      ) : (
                        <div className="space-y-4">
                          {farmerOrders.slice(0, 5).map(order => (
                            <Card key={order.id} className="p-4 space-y-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('order_label')} #{order.id.slice(0, 6)}</p>
                                  <p className="text-sm font-bold">{order.items.filter(i => i.sellerId === user?.uid).map(i => i.name).join(", ")}</p>
                                </div>
                                <select 
                                  value={order.status}
                                  onChange={(e) => safeUpdateDoc(doc(db, "orders", order.id), { status: e.target.value })}
                                  className={cn(
                                    "text-[10px] font-bold uppercase px-2 py-1 rounded border-none outline-none cursor-pointer",
                                    order.status === "delivered" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                  )}
                                >
                                  <option value="pending">{t('status_pending')}</option>
                                  <option value="processing">{t('status_processing')}</option>
                                  <option value="shipped">{t('status_shipped')}</option>
                                  <option value="delivered">{t('status_delivered')}</option>
                                </select>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">{t('buyer_label')}: {order.buyerName}</span>
                                <span className="font-bold text-emerald-600">₹{order.items.filter(i => i.sellerId === user?.uid).reduce((sum, i) => sum + (i.price * i.quantity), 0)}</span>
                              </div>
                            </Card>
                          ))}
                          {farmerOrders.length > 5 && (
                            <Button variant="ghost" className="w-full text-xs text-slate-500" onClick={() => navigateTo("orders")}>
                              {t('view_all_orders')}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-xl font-bold">{t('your_recent_listings')}</h3>
                      {products.filter(p => p.authorUid === user?.uid).slice(0, 3).map(product => (
                        <Card key={product.id} className="p-4 flex items-center gap-4">
                          <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                            {product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-cover" /> : <Leaf className="w-full h-full p-4 text-slate-300" />}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold">{product.name}</h4>
                            <p className="text-xs text-slate-500">{product.location}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-emerald-600">₹{product.price}</p>
                            <p className="text-[10px] uppercase font-bold text-slate-400">{product.grade}</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === "marketplace" && (
            <motion.div 
              key="marketplace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900">{t('marketplace')}</h2>
                    <p className="text-slate-500">{t('marketplace_desc')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Input 
                      placeholder={t('search_placeholder')} 
                      className="w-full md:w-64" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <select 
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium bg-white"
                    >
                      <option value="newest">{t('newest_first')}</option>
                      <option value="price-low">{t('price_low_high')}</option>
                      <option value="price-high">{t('price_high_low')}</option>
                    </select>
                    <Button variant="outline" onClick={() => { 
                      setSearchQuery(""); 
                      setGradeFilter("all"); 
                      setLocationFilter("");
                      setMinPrice("");
                      setMaxPrice("");
                      setCropTypeFilter("all");
                      setSortBy("newest");
                    }}>{t('reset_all')}</Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">{t('crop_type')}</label>
                    <select 
                      value={cropTypeFilter}
                      onChange={(e) => setCropTypeFilter(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
                    >
                      <option value="all">{t('all_crops')}</option>
                      {Array.from(new Set(products.map(p => p.crop))).filter(Boolean).map(crop => (
                        <option key={crop} value={crop}>{crop}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">{t('location')}</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        placeholder={t('filter_location')} 
                        className="pl-9" 
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">{t('price_range')}</label>
                    <div className="flex items-center gap-2">
                      <Input 
                        placeholder={t('min_placeholder')} 
                        type="number"
                        className="w-full" 
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                      />
                      <span className="text-slate-300">-</span>
                      <Input 
                        placeholder={t('max_placeholder')} 
                        type="number"
                        className="w-full" 
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">{t('quality_grade')}</label>
                    <select 
                      value={gradeFilter}
                      onChange={(e) => setGradeFilter(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
                    >
                      <option value="all">{t('all_grades')}</option>
                      <option value="Grade A">{t('grade_a')}</option>
                      <option value="Grade B">{t('grade_b')}</option>
                      <option value="Grade C">{t('grade_c')}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAndSortedProducts.length === 0 ? (
                  <div className="col-span-full py-20 text-center">
                    <ShoppingBag className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">{t('no_products_found')}</p>
                  </div>
                ) : filteredAndSortedProducts.map(product => (
                  <Card key={product.id} className="group hover:shadow-lg transition-all">
                    <div className="aspect-square bg-slate-100 relative overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Leaf className="w-12 h-12" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3 flex gap-2">
                        <span className="px-2 py-1 bg-white/90 backdrop-blur text-[10px] font-bold rounded-full shadow-sm">{product.crop}</span>
                        {product.grade && (
                          <span className={cn(
                            "px-2 py-1 text-[10px] font-bold rounded-full shadow-sm",
                            product.grade.includes("A") ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                          )}>{product.grade}</span>
                        )}
                      </div>
                    </div>
                      <div className="p-4 space-y-3">
                        <div>
                          <h4 className="font-bold text-lg">{product.name || t('unnamed_product')}</h4>
                          <div className="flex items-center gap-1 text-slate-500 text-xs">
                            <MapPin className="w-3 h-3" /> {product.location || t('unknown_location')}
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                          <div>
                            <p className="text-xs text-slate-400">{t('price_per_kg')}</p>
                            <p className="text-xl font-bold text-emerald-600">₹{product.price || 0}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              className="rounded-full w-10 h-10 p-0 text-red-600 hover:bg-red-50 hover:border-red-200"
                              title="Send Inquiry via Gmail"
                              onClick={() => {
                                handleOpenGmailWithDraft(
                                  "",
                                  `🌾 AgriNet Inquiry: ${product.name} (${product.crop})`,
                                  `<p>Hello ${product.authorName},</p><p>I am interested in purchasing your listing <strong>${product.name} (${product.crop})</strong> for ₹${product.price}/kg located in ${product.location}.</p><p>Could you let me know batch quantity and pickup schedule?</p><p>Regards,<br/><strong>${profile?.name || "Buyer"}</strong></p>`
                                );
                              }}
                            >
                              <Mail className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              className="rounded-full w-10 h-10 p-0"
                              onClick={() => {
                                setChatPartner({
                                  uid: product.authorUid,
                                  name: product.authorName,
                                  productId: product.id,
                                  productName: product.name
                                });
                                navigateTo("messages");
                              }}
                            >
                              <MessageSquare className="w-5 h-5" />
                            </Button>
                            <Button 
                              className="rounded-full w-10 h-10 p-0"
                              onClick={() => addToCart(product)}
                            >
                              <ShoppingBag className="w-5 h-5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 italic">{t('farmer_label')}: {product.authorName || t('unknown_farmer')}</p>
                      </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {view === "messages" && (
            <motion.div 
              key="messages"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-[calc(100vh-12rem)] flex flex-col md:flex-row gap-6"
            >
              {/* Conversation List */}
              <Card className="w-full md:w-80 flex flex-col">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-lg">{t('conversations')}</h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {Array.from(new Set(messages.map(m => m.senderId === user?.uid ? m.receiverId : m.senderId))).map(partnerId => {
                    const lastMsg = [...messages].reverse().find(m => m.senderId === partnerId || m.receiverId === partnerId);
                    const partnerName = lastMsg?.senderId === partnerId ? lastMsg.senderName : (messages.find(m => m.receiverId === partnerId)?.senderName || "Unknown");
                    
                    return (
                      <button 
                        key={partnerId}
                        onClick={() => setChatPartner({ uid: partnerId, name: partnerName })}
                        className={cn(
                          "w-full p-4 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 flex flex-col gap-1",
                          chatPartner?.uid === partnerId && "bg-emerald-50 hover:bg-emerald-50 border-l-4 border-l-emerald-600"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold">{partnerName}</span>
                          <span className="text-[10px] text-slate-400">
                            {lastMsg?.createdAt?.toDate ? lastMsg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{lastMsg?.text}</p>
                      </button>
                    );
                  })}
                  {messages.length === 0 && (
                    <div className="p-8 text-center text-slate-400">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">{t('no_messages_yet')}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Active Chat */}
              <Card className="flex-1 flex flex-col">
                {chatPartner ? (
                  <>
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                      <div>
                        <h3 className="font-bold">{chatPartner.name}</h3>
                        {chatPartner.productName && (
                          <p className="text-[10px] text-slate-400">{t('discussing')}: {chatPartner.productName}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-xs text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1.5"
                          onClick={() => {
                            handleOpenGmailWithDraft(
                              "",
                              `🌾 AgriNet Trade Communication: ${chatPartner.name}${chatPartner.productName ? ` - ${chatPartner.productName}` : ""}`,
                              `<p>Hello ${chatPartner.name},</p><p>Following up on our AgriNet conversation${chatPartner.productName ? ` regarding <strong>${chatPartner.productName}</strong>` : ""}.</p><p>Regards,<br/><strong>${profile?.name || "Farmer"}</strong></p>`
                            );
                          }}
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Email via Gmail</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setChatPartner(null)} className="md:hidden">{t('back')}</Button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                      {messages
                        .filter(m => m.senderId === chatPartner.uid || m.receiverId === chatPartner.uid)
                        .map(msg => (
                          <div 
                            key={msg.id}
                            className={cn(
                              "max-w-[80%] p-3 rounded-2xl text-sm shadow-sm",
                              msg.senderId === user?.uid 
                                ? "ml-auto bg-emerald-600 text-white rounded-tr-none" 
                                : "mr-auto bg-white text-slate-700 rounded-tl-none"
                            )}
                          >
                            <p>{msg.text}</p>
                            <p className={cn(
                              "text-[10px] mt-1",
                              msg.senderId === user?.uid ? "text-emerald-100" : "text-slate-400"
                            )}>
                              {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t('sending_dots')}
                            </p>
                          </div>
                        ))}
                    </div>
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 flex gap-2 bg-white">
                      <Input 
                        placeholder={t('type_message')} 
                        value={newMessageText}
                        onChange={(e) => setNewMessageText(e.target.value)}
                      />
                      <Button type="submit" className="px-6">
                        <Send className="w-4 h-4" />
                      </Button>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <MessageSquare className="w-8 h-8 opacity-20" />
                    </div>
                    <h3 className="font-bold text-slate-900 mb-1">{t('select_conversation')}</h3>
                    <p className="text-sm text-center max-w-xs">{t('select_conversation_desc')}</p>
                    <Button variant="outline" className="mt-6" onClick={() => navigateTo("marketplace")}>{t('go_to_marketplace')}</Button>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {view === "cart" && (
            <motion.div 
              key="cart"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold">{t('your_cart')}</h2>
                <Button variant="outline" onClick={() => navigateTo("marketplace")}>{t('continue_shopping')}</Button>
              </div>
              
              {cartItems.length === 0 ? (
                <Card className="p-12 text-center space-y-4">
                  <ShoppingCart className="w-16 h-16 text-slate-200 mx-auto" />
                  <p className="text-slate-500 font-medium">{t('cart_empty')}</p>
                  <Button onClick={() => navigateTo("marketplace")}>{t('go_to_marketplace')}</Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-4">
                    {cartItems.map(item => (
                      <Card key={item.id} className="p-4 flex items-center gap-4">
                        <div className="w-20 h-20 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                          {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <Leaf className="w-full h-full p-4 text-slate-300" />}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-lg">{item.name}</h4>
                          <p className="text-xs text-slate-500">{t('seller_label')}: {item.sellerName}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center border border-slate-200 rounded-lg">
                              <button 
                                onClick={() => item.quantity > 1 && safeUpdateDoc(doc(db, "users", user!.uid, "cart", item.id), { quantity: item.quantity - 1 })}
                                className="p-1 hover:bg-slate-50"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="px-3 font-medium">{item.quantity}</span>
                              <button 
                                onClick={() => safeUpdateDoc(doc(db, "users", user!.uid, "cart", item.id), { quantity: item.quantity + 1 })}
                                className="p-1 hover:bg-slate-50"
                              >
                                <PlusCircle className="w-4 h-4" />
                              </button>
                            </div>
                            <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-600 text-sm font-medium flex items-center gap-1">
                              <Trash2 className="w-4 h-4" /> {t('remove')}
                            </button>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600 text-lg">₹{item.price * item.quantity}</p>
                          <p className="text-xs text-slate-400">₹{item.price} / kg</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                  
                  <div className="space-y-6">
                    <Card className="p-6 space-y-4">
                      <h3 className="font-bold text-xl">{t('order_summary')}</h3>
                      <div className="space-y-2 border-b border-slate-100 pb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">{t('subtotal')}</span>
                          <span className="font-medium">₹{cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">{t('delivery_fee')}</span>
                          <span className="text-emerald-600 font-medium">{t('free')}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="font-bold text-lg">{t('total')}</span>
                        <span className="font-bold text-2xl text-emerald-600">₹{cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)}</span>
                      </div>
                      <Button className="w-full py-6 text-lg" onClick={() => navigateTo("checkout")}>{t('proceed_to_checkout_btn')}</Button>
                    </Card>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === "checkout" && (
            <motion.div key="checkout" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-4xl mx-auto space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold">{t('checkout')}</h2>
                <div className="flex items-center gap-4">
                  <div className={cn("flex items-center gap-2", checkoutStep === "summary" ? "text-emerald-600" : "text-slate-400")}>
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", checkoutStep === "summary" ? "bg-emerald-600 text-white" : "bg-slate-100")}>1</div>
                    <span className="text-sm font-medium">{t('summary')}</span>
                  </div>
                  <div className="w-8 h-px bg-slate-200" />
                  <div className={cn("flex items-center gap-2", checkoutStep === "address" ? "text-emerald-600" : "text-slate-400")}>
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", checkoutStep === "address" ? "bg-emerald-600 text-white" : "bg-slate-100")}>2</div>
                    <span className="text-sm font-medium">{t('address')}</span>
                  </div>
                  <div className="w-8 h-px bg-slate-200" />
                  <div className={cn("flex items-center gap-2", checkoutStep === "payment" ? "text-emerald-600" : "text-slate-400")}>
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", checkoutStep === "payment" ? "bg-emerald-600 text-white" : "bg-slate-100")}>3</div>
                    <span className="text-sm font-medium">{t('payment_label')}</span>
                  </div>
                </div>
              </div>

              {checkoutStep === "summary" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-4">
                    {cartItems.map(item => (
                      <Card key={item.id} className="p-4 flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                          {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <Leaf className="w-full h-full p-4 text-slate-300" />}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold">{item.name}</h4>
                          <p className="text-xs text-slate-500">₹{item.price} x {item.quantity}</p>
                        </div>
                        <p className="font-bold text-emerald-600">₹{item.price * item.quantity}</p>
                      </Card>
                    ))}
                  </div>
                  <Card className="p-6 h-fit space-y-4">
                    <h3 className="font-bold text-lg">{t('order_summary')}</h3>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('items_total')}</span>
                      <span className="font-medium">₹{cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('delivery')}</span>
                      <span className="text-emerald-600 font-medium">{t('free')}</span>
                    </div>
                    <div className="pt-4 border-t flex justify-between items-center">
                      <span className="font-bold">{t('total')}</span>
                      <span className="font-bold text-xl text-emerald-600">₹{cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)}</span>
                    </div>
                    <Button className="w-full py-4" onClick={() => setCheckoutStep("address")}>{t('continue_to_address')}</Button>
                  </Card>
                </div>
              )}

              {checkoutStep === "address" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <Card className="p-6 space-y-6">
                      <div className="flex items-center gap-2 text-emerald-600">
                        <MapPin className="w-5 h-5" />
                        <h3 className="font-bold text-lg">{t('shipping_details')}</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t('full_address')}</label>
                          <textarea 
                            className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none min-h-[120px]"
                            placeholder={t('address_placeholder')}
                            value={checkoutAddress}
                            onChange={(e) => setCheckoutAddress(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t('contact_number')}</label>
                          <Input 
                            placeholder={t('phone_placeholder_checkout')} 
                            value={checkoutPhone}
                            onChange={(e) => setCheckoutPhone(e.target.value)}
                          />
                        </div>
                      </div>
                    </Card>
                  </div>
                  <Card className="p-6 h-fit space-y-4">
                    <h3 className="font-bold text-lg">{t('order_summary')}</h3>
                    <div className="flex justify-between items-center">
                      <span className="font-bold">{t('total_payable')}</span>
                      <span className="font-bold text-xl text-emerald-600">₹{cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)}</span>
                    </div>
                    <Button 
                      className="w-full py-4" 
                      disabled={!checkoutAddress.trim() || !checkoutPhone.trim()}
                      onClick={() => setCheckoutStep("payment")}
                    >
                      {t('continue_to_payment')}
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={() => setCheckoutStep("summary")}>{t('back')}</Button>
                  </Card>
                </div>
              )}

              {checkoutStep === "payment" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <Card className="p-6 space-y-6">
                      <div className="flex items-center gap-2 text-emerald-600">
                        <CreditCard className="w-5 h-5" />
                        <h3 className="font-bold text-lg">{t('select_payment_method')}</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { id: "upi", name: t('upi'), desc: t('upi_desc'), icon: <Smartphone className="w-5 h-5" /> },
                          { id: "card", name: t('card'), desc: t('card_desc'), icon: <CreditCard className="w-5 h-5" /> },
                          { id: "netbanking", name: t('net_banking'), desc: t('net_banking_desc'), icon: <Building2 className="w-5 h-5" /> },
                          { id: "cod", name: t('cod'), desc: t('cod_desc'), icon: <Wallet className="w-5 h-5" /> }
                        ].map(method => (
                          <button 
                            key={method.id}
                            onClick={() => setSelectedPaymentMethod(method.id as any)}
                            className={cn(
                              "p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4",
                              selectedPaymentMethod === method.id ? "border-emerald-600 bg-emerald-50" : "border-slate-100 hover:border-slate-200"
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              selectedPaymentMethod === method.id ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                            )}>
                              {method.icon}
                            </div>
                            <div className="flex-1">
                              <p className="font-bold">{method.name}</p>
                              <p className="text-[10px] text-slate-500">{method.desc}</p>
                            </div>
                            <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", selectedPaymentMethod === method.id ? "border-emerald-600" : "border-slate-300")}>
                              {selectedPaymentMethod === method.id && <div className="w-2.5 h-2.5 bg-emerald-600 rounded-full" />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </Card>
                  </div>
                  <Card className="p-6 h-fit space-y-4">
                    <h3 className="font-bold text-lg">{t('order_summary')}</h3>
                    <div className="flex justify-between items-center">
                      <span className="font-bold">{t('total_payable')}</span>
                      <span className="font-bold text-xl text-emerald-600">₹{cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)}</span>
                    </div>
                    <Button 
                      className="w-full py-4 mt-4" 
                      disabled={isProcessingPayment}
                      onClick={handlePlaceOrder}
                    >
                      {isProcessingPayment ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {t('processing_dots')}
                        </div>
                      ) : (
                        selectedPaymentMethod === "cod" ? t('place_order_cod') : t('pay_now')
                      )}
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={() => setCheckoutStep("address")}>{t('back')}</Button>
                  </Card>
                </div>
              )}
            </motion.div>
          )}

          {view === "orders" && (
            <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold">{t('orders_management')}</h2>
                <Button variant="outline" onClick={() => navigateTo("marketplace")}>{t('shop_more')}</Button>
              </div>

              {profile?.role === "farmer" && (
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                      {t('sales_orders_incoming')}
                    </h3>
                    {farmerOrders.length === 0 ? (
                      <Card className="p-8 text-center text-slate-400">{t('no_sales_orders')}</Card>
                    ) : (
                      <div className="space-y-4">
                        {farmerOrders.map(order => (
                          <Card key={order.id} className="p-6 border-l-4 border-l-blue-500">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <p className="text-xs font-bold text-slate-400 uppercase">{t('order_id')}: {order.id.slice(0, 8)}</p>
                                <p className="text-sm font-medium">{t('buyer_label')}: {order.buyerName}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-blue-600">₹{order.totalAmount}</p>
                                <span className={cn(
                                  "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                                  order.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                )}>
                                  {order.paymentStatus}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-2 mb-4">
                              {order.items.filter(item => item.sellerId === user?.uid).map((item, idx) => (
                                <p key={idx} className="text-sm">{item.name} x {item.quantity} (₹{item.price}/kg)</p>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-50">
                              {order.paymentStatus === "paid" && order.status !== "delivered" && order.status !== "cancelled" && (
                                <>
                                  {order.status === "pending" && (
                                    <Button 
                                      size="sm" 
                                      className="bg-blue-600 hover:bg-blue-700"
                                      onClick={() => safeUpdateDoc(doc(db, "orders", order.id), { status: "processing" })}
                                    >
                                      {t('start_processing')}
                                    </Button>
                                  )}
                                  {order.status === "processing" && (
                                    <Button 
                                      size="sm" 
                                      className="bg-indigo-600 hover:bg-indigo-700"
                                      onClick={() => safeUpdateDoc(doc(db, "orders", order.id), { status: "shipped" })}
                                    >
                                      {t('mark_shipped')}
                                    </Button>
                                  )}
                                  {order.status === "shipped" && (
                                    <Button 
                                      size="sm" 
                                      className="bg-emerald-600 hover:bg-emerald-700"
                                      onClick={() => safeUpdateDoc(doc(db, "orders", order.id), { status: "delivered" })}
                                    >
                                      {t('mark_delivered')}
                                    </Button>
                                  )}
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => safeUpdateDoc(doc(db, "orders", order.id), { status: "cancelled" })}
                                  >
                                    {t('cancel')}
                                  </Button>
                                </>
                              )}
                              {order.paymentStatus === "pending" && order.paymentMethod !== "cod" && (
                                <p className="text-xs text-amber-600 font-medium italic flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> {t('awaiting_buyer_payment')}
                                </p>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                  <hr className="border-slate-100" />
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-600" />
                  {t('my_purchases')}
                </h3>
                {userOrders.length === 0 ? (
                  <Card className="p-12 text-center space-y-4">
                    <Package className="w-16 h-16 text-slate-200 mx-auto" />
                    <p className="text-slate-500 font-medium">{t('no_orders_placed')}</p>
                    <Button onClick={() => navigateTo("marketplace")}>{t('start_shopping')}</Button>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {userOrders.map(order => (
                      <Card key={order.id} className="p-6 space-y-4 border-l-4 border-l-emerald-500">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-4">
                          <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t('order_id')}: {order.id.slice(0, 8)}</p>
                            <p className="text-sm text-slate-500">{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : t('recent')} {t('at')} {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleTimeString() : ''}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold uppercase",
                              order.status === "delivered" ? "bg-emerald-100 text-emerald-700" : 
                              order.status === "cancelled" ? "bg-red-100 text-red-700" :
                              "bg-amber-100 text-amber-700"
                            )}>
                              {order.status}
                            </span>
                            <span className="text-lg font-bold text-emerald-600">₹{order.totalAmount}</span>
                          </div>
                        </div>

                        {/* Order Tracking Component */}
                        <div className="py-2 border-b border-slate-50">
                          <OrderTracking status={order.status} t={t} />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-400 uppercase">{t('items')}</h4>
                            <div className="space-y-1">
                              {order.items.map((item, idx) => (
                                <p key={idx} className="text-sm">{item.name} x {item.quantity} (₹{item.price}/kg)</p>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-400 uppercase">{t('delivery_details')}</h4>
                            <p className="text-sm text-slate-600">{order.address}</p>
                            <p className="text-sm font-medium">{t('payment_label')}: {order.paymentMethod.toUpperCase()} ({order.paymentStatus})</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                          <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                            <Truck className="w-4 h-4" />
                            {order.status === "pending" ? t('awaiting_confirmation') : order.status === "processing" ? t('being_packed') : t('on_the_way')}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-xs text-slate-600 hover:text-emerald-700 flex items-center gap-1"
                              onClick={() => {
                                handleOpenGmailWithDraft(
                                  profile?.email || "",
                                  `🧾 Order Invoice #${order.id.slice(0, 8)} - AgriNet AI`,
                                  `<div style="font-family: sans-serif; padding: 18px; border: 1px solid #e2e8f0; border-radius: 8px;"><h2 style="color: #059669;">AgriNet AI Order Invoice</h2><p><strong>Order ID:</strong> #${order.id}</p><p><strong>Status:</strong> ${order.status}</p><p><strong>Total Paid/Payable:</strong> ₹${order.totalAmount}</p><p><strong>Delivery Address:</strong> ${order.address}</p></div>`
                                );
                              }}
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Email Receipt</span>
                            </Button>
                            {order.paymentStatus === "pending" && order.paymentMethod !== "cod" && (
                              <Button size="sm" onClick={() => { setLastOrderId(order.id); setShowPaymentSelector(true); }}>
                                {t('pay_now')}
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === "wallet" && (
            <motion.div key="wallet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold">{t('my_wallet')}</h2>
                <Button onClick={() => setShowWithdrawalModal(true)} className="bg-emerald-600 hover:bg-emerald-700">
                  {t('withdraw_funds')}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 bg-emerald-600 text-white">
                  <p className="text-sm opacity-80 mb-1">{t('available_balance')}</p>
                  <h3 className="text-3xl font-bold">₹{profile?.walletBalance?.toFixed(2) || "0.00"}</h3>
                </Card>
                <Card className="p-6 bg-white border border-slate-100">
                  <p className="text-sm text-slate-500 mb-1">{t('total_sales')}</p>
                  <h3 className="text-3xl font-bold text-slate-900">₹{transactions.filter(t => t.category === "sale").reduce((sum, t) => sum + t.amount, 0).toFixed(2)}</h3>
                </Card>
                <Card className="p-6 bg-white border border-slate-100">
                  <p className="text-sm text-slate-500 mb-1">{t('pending_withdrawals')}</p>
                  <h3 className="text-3xl font-bold text-amber-600">₹{transactions.filter(t => t.category === "withdrawal" && t.status === "pending").reduce((sum, t) => sum + t.amount, 0).toFixed(2)}</h3>
                </Card>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-bold">{t('transaction_history')}</h3>
                {transactions.length === 0 ? (
                  <Card className="p-12 text-center text-slate-400 italic">{t('no_transactions')}</Card>
                ) : (
                  <div className="space-y-3">
                    {transactions.map(tx => (
                      <Card key={tx.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            tx.type === "credit" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                          )}>
                            {tx.type === "credit" ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{tx.description}</p>
                            <p className="text-xs text-slate-500">{tx.createdAt?.toDate().toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("font-bold", tx.type === "credit" ? "text-emerald-600" : "text-red-600")}>
                            {tx.type === "credit" ? "+" : "-"}₹{tx.amount.toFixed(2)}
                          </p>
                          <span className={cn(
                            "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                            tx.status === "completed" ? "bg-emerald-100 text-emerald-700" : 
                            tx.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                          )}>
                            {tx.status}
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === "admin" && profile?.role === "admin" && (
            <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-8">
              <h2 className="text-3xl font-bold">{t('admin_control_panel')}</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="p-6 bg-slate-900 text-white">
                  <p className="text-sm opacity-80 mb-1">{t('platform_sales')}</p>
                  <h3 className="text-2xl font-bold">₹{allOrders.filter(o => o.paymentStatus === "paid").reduce((sum, o) => sum + o.totalAmount, 0).toFixed(2)}</h3>
                </Card>
                <Card className="p-6 bg-emerald-600 text-white">
                  <p className="text-sm opacity-80 mb-1">{t('total_commission')}</p>
                  <h3 className="text-2xl font-bold">₹{(allOrders.filter(o => o.paymentStatus === "paid").reduce((sum, o) => sum + o.totalAmount, 0) * 0.1).toFixed(2)}</h3>
                </Card>
                <Card className="p-6 bg-white border border-slate-100">
                  <p className="text-sm text-slate-500 mb-1">{t('pending_payouts')}</p>
                  <h3 className="text-2xl font-bold text-amber-600">₹{allWithdrawals.filter(w => w.status === "pending").reduce((sum, w) => sum + w.amount, 0).toFixed(2)}</h3>
                </Card>
                <Card className="p-6 bg-white border border-slate-100">
                  <p className="text-sm text-slate-500 mb-1">{t('total_orders')}</p>
                  <h3 className="text-2xl font-bold text-slate-900">{allOrders.length}</h3>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                    {t('pending_withdrawal_requests')}
                  </h3>
                  {allWithdrawals.filter(w => w.status === "pending").length === 0 ? (
                    <Card className="p-8 text-center text-slate-400 italic">{t('no_pending_requests')}</Card>
                  ) : (
                    <div className="space-y-4">
                      {allWithdrawals.filter(w => w.status === "pending").map(tx => (
                        <Card key={tx.id} className="p-4 space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-slate-900">₹{tx.amount.toFixed(2)}</p>
                              <p className="text-xs text-slate-500">{tx.description}</p>
                              <p className="text-[10px] text-slate-400 mt-1">{t('requested_on')}: {tx.createdAt?.toDate().toLocaleString()}</p>
                            </div>
                            <Button size="sm" onClick={() => handleApproveWithdrawal(tx.id)}>
                              {t('approve_and_pay')}
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Package className="w-5 h-5 text-emerald-600" />
                    {t('recent_platform_orders')}
                  </h3>
                  <div className="space-y-3">
                    {allOrders.slice(0, 5).map(order => (
                      <Card key={order.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm">{t('order_label')} #{order.id.slice(0, 8)}</p>
                          <p className="text-xs text-slate-500">{order.buyerName} • ₹{order.totalAmount}</p>
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-2 py-1 rounded",
                          order.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {order.paymentStatus}
                        </span>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === "gmail" && profile && (
            <motion.div 
              key="gmail" 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -15 }}
              className="max-w-6xl mx-auto space-y-6"
            >
              <GmailHub 
                currentUserEmail={profile.email || user?.email || ""} 
                currentUserName={profile.name || "Farmer"}
                defaultComposeTo={gmailDraftTo}
                defaultComposeSubject={gmailDraftSubject}
                defaultComposeBody={gmailDraftBody}
                onCloseCompose={() => {
                  setGmailDraftTo("");
                  setGmailDraftSubject("");
                  setGmailDraftBody("");
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Global Modals & Overlays */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div 
            key="notifications-dropdown-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] pointer-events-none"
            onClick={() => setShowNotifications(false)}
          >
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-16 right-4 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-white">
                <h3 className="font-bold">{t('notifications')}</h3>
                <button onClick={() => setShowNotifications(false)} className="text-xs text-emerald-600 hover:underline">{t('close')}</button>
              </div>
              <div className="max-h-96 overflow-y-auto bg-white">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">{t('no_notifications')}</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={cn("p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer", !n.isRead && "bg-emerald-50/30")}>
                      <div className="flex gap-3">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", 
                          n.type === "order" ? "bg-blue-100 text-blue-600" : 
                          n.type === "payment" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600")}>
                          {n.type === "order" ? <Package className="w-4 h-4" /> : 
                           n.type === "payment" ? <CreditCard className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold leading-tight">{n.title}</p>
                          <p className="text-xs text-slate-500 leading-tight">{n.message}</p>
                          <p className="text-[10px] text-slate-400">{n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : ""}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {showOrderSuccess && (
          <motion.div 
            key="order-success-overlay"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12 text-emerald-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-900">{t('order_confirmed')}</h3>
                <p className="text-slate-500">{t('order_confirmed_desc')}</p>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showPaymentSelector && lastOrderId && (
          <motion.div 
            key="payment-selector-overlay"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-slate-900">{t('complete_payment')}</h3>
                <button onClick={() => setShowPaymentSelector(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-slate-600">{t('complete_payment_desc')}</p>
                <Button 
                  className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-lg font-bold shadow-lg shadow-emerald-100"
                  onClick={() => handleManualPayment(lastOrderId)}
                  disabled={isProcessingPayment}
                >
                  {isProcessingPayment ? t('processing_dots') : t('pay_now_razorpay')}
                </Button>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs text-center text-slate-400">{t('secure_payment_desc')}</p>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showPaymentDetailsPrompt && (
          <motion.div 
            key="payment-details-prompt-overlay"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full space-y-6 shadow-2xl"
            >
              <div className="space-y-2">
                <h3 className="text-xl font-bold">{t('setup_payment_receiving')}</h3>
                <p className="text-sm text-slate-500">{t('setup_payment_desc')}</p>
              </div>
              <form onSubmit={updatePaymentDetails} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('upi_id_label')}</label>
                  <Input 
                    placeholder="example@upi" 
                    value={paymentDetailsForm.upiId}
                    onChange={e => setPaymentDetailsForm({...paymentDetailsForm, upiId: e.target.value})}
                  />
                </div>
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">{t('or_bank_details')}</span></div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('bank_name')}</label>
                  <Input 
                    placeholder="e.g. SBI, HDFC" 
                    value={paymentDetailsForm.bankName}
                    onChange={e => setPaymentDetailsForm({...paymentDetailsForm, bankName: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('account_number')}</label>
                  <Input 
                    placeholder={t('enter_account_number')} 
                    value={paymentDetailsForm.accountNumber}
                    onChange={e => setPaymentDetailsForm({...paymentDetailsForm, accountNumber: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">{t('ifsc_code')}</label>
                  <Input 
                    placeholder={t('enter_ifsc_code')} 
                    value={paymentDetailsForm.ifscCode}
                    onChange={e => setPaymentDetailsForm({...paymentDetailsForm, ifscCode: e.target.value})}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowPaymentDetailsPrompt(false)}>{t('later')}</Button>
                  <Button type="submit" className="flex-1">{t('save_details')}</Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {(isListening || isProcessingVoice || voiceTranscript) && (
          <motion.div 
            key="voice-assistant-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-28 right-8 max-w-xs w-full z-50"
          >
            <Card className="p-4 bg-emerald-900 text-white border-emerald-700 shadow-2xl">
              <div className="flex items-center gap-3 mb-2">
                {isProcessingVoice ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                ) : (
                  <div className={cn("w-2 h-2 rounded-full", isListening ? "bg-red-500 animate-pulse" : "bg-emerald-400")} />
                )}
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                  {isListening ? t('listening_dots') : isProcessingVoice ? t('processing_dots') : t('assistant')}
                </span>
              </div>
              <p className="text-sm font-medium italic">
                {voiceTranscript ? `"${voiceTranscript}"` : (isListening ? t('listening_dots') : t('how_can_i_help'))}
              </p>
            </Card>
          </motion.div>
        )}

        {showWithdrawalModal && (
          <motion.div 
            key="withdrawal-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              key="withdrawal-modal-content"
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">{t('request_withdrawal')}</h3>
                <button onClick={() => setShowWithdrawalModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleWithdrawalRequest} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('available_balance')}: ₹{profile?.walletBalance?.toFixed(2) || "0.00"}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={t('enter_amount')}
                      className="pl-8"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 mb-2 uppercase font-bold tracking-wider">{t('withdraw_to')}:</p>
                  <p className="text-sm font-medium text-slate-900">{profile?.paymentDetails?.upiId || t('no_payment_details')}</p>
                  {profile?.paymentDetails?.bankName && (
                    <p className="text-xs text-slate-500">{profile.paymentDetails.bankName} - {profile.paymentDetails.accountNumber}</p>
                  )}
                </div>

                <Button type="submit" className="w-full py-4 text-lg" disabled={!profile?.paymentDetails}>
                  {t('confirm_withdrawal')}
                </Button>
                {!profile?.paymentDetails && (
                  <p className="text-xs text-red-500 text-center">{t('setup_payment_first')}</p>
                )}
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {user && (
        <button 
          onClick={handleVoiceAssistant}
          disabled={isProcessingVoice}
          className={cn(
            "fixed bottom-8 right-8 w-16 h-16 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50",
            isListening ? "bg-red-500 animate-pulse" : isProcessingVoice ? "bg-emerald-800" : "bg-emerald-600"
          )}
        >
          {isProcessingVoice ? <Loader2 className="w-8 h-8 animate-spin" /> : <Mic className="w-8 h-8" />}
        </button>
      )}
    </div>
  );
}
