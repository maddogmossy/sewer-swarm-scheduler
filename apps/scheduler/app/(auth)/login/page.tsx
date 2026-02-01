"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, GripHorizontal, Users, Zap, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
  active: boolean;
  metadata: Record<string, string> | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  metadata: Record<string, string> | null;
  prices: Price[];
}

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isYearly, setIsYearly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const { data: productsData, isLoading: productsLoading } = useQuery<{ data: Product[] }>({
    queryKey: ['/api/stripe/products'],
    queryFn: async () => {
      const res = await fetch('/api/stripe/products');
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
  });

  const products = productsData?.data || [];
  const starterProduct = products.find(p => p.metadata?.tier === 'starter');
  const proProduct = products.find(p => p.metadata?.tier === 'pro');

  const getPrice = (product: Product | undefined, interval: 'month' | 'year') => {
    if (!product) return null;
    return product.prices.find(p => p.recurring?.interval === interval);
  };

  const formatPrice = (price: Price | null | undefined) => {
    if (!price) return '—';
    const amount = price.unit_amount / 100;
    const currency = price.currency.toUpperCase();
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;
    return `${symbol}${amount}`;
  };

  const handleCheckout = async (priceId: string, trialDays?: number) => {
    setCheckoutLoading(priceId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priceId, trialDays }),
      });

      if (res.status === 401) {
        toast({
          title: "Please sign in first",
          description: "Create an account or sign in to start your subscription",
          variant: "destructive",
        });
        return;
      }

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Checkout failed');
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error: any) {
      toast({
        title: "Checkout failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  // Check if user is already logged in
  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((res) => {
        if (res.ok) {
          setIsAuthenticated(true);
          router.push("/schedule");
        }
      })
      .catch(() => {
        // Not logged in, show login page
      });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await api.login(email, password);

      toast({
        title: "Welcome back!",
        description: "Logged in successfully",
      });
      
      router.push("/schedule");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // If authenticated, don't render (will redirect)
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm shrink-0">
            <span className="text-white font-bold text-lg">≈</span>
          </div>
          <span className="text-xl font-bold text-blue-900 tracking-tight">Sewer Swarm AI</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
          <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Standards</a>
        </nav>
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="text-slate-600 hover:text-blue-600">Sign In</Button>
          <Link href="/register">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 py-16 md:py-24 max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <h1 className="text-4xl md:text-6xl font-bold text-slate-900 leading-tight">
            Sewer Swarm <br/>
            <span className="text-blue-900">Intelligent Crew Scheduling</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-lg leading-relaxed">
            The ultimate drag-and-drop scheduling platform built for drainage, civils, CCTV surveying, jetting, lining, and utility contractors. Optimise your workforce with AI-driven logic, instant conflict alerts, and real-time crew visibility.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Drag & Drop Simplicity</h3>
                <p className="text-sm text-slate-500">Assign jobs, operatives, assistants, and vehicles in seconds. Reschedule effortlessly across days and depots.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">AI Logic Engine</h3>
                <p className="text-sm text-slate-500">Automatically detects clashes, double-bookings, and vehicle conflicts. Suggests optimal crew setups for each job.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Utility-Grade Performance</h3>
                <p className="text-sm text-slate-500">Built for companies of all sizes — from single-van operators to multi-depot utility contractors.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="flex justify-center md:justify-end">
          <Card className="w-full max-w-md shadow-xl border-slate-100">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
              <CardDescription>Sign in to manage your teams, jobs, and depot schedules.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="yourname@company.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-slate-200 focus:ring-blue-600"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="border-slate-200 focus:ring-blue-600"
                  />
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base" disabled={loading}>
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing in...</> : "Sign In"}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="justify-center border-t border-slate-50 pt-6 pb-6 flex-col gap-2">
              <p className="text-sm text-slate-500">
                New here? <Link href="/register" className="text-blue-600 hover:underline font-medium">Start your free trial → Sign Up</Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Why Choose Sewer Swarm AI?</h2>
            <p className="text-slate-600 text-lg">
              Built specifically for utility managers who need speed, accuracy, and flexibility in their scheduling.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                  <GripHorizontal className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Drag & Drop Interface</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 leading-relaxed">
                  A clean, intuitive calendar matrix built around drainage & civils workflows. Quickly move jobs, swap crews, and rebalance workloads during the working day.
                </p>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle className="text-xl">AI Logic Engine</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 leading-relaxed">
                  Smart routing and conflict detection. The system flags clashes, advises on crew availability, and prevents double-booking of vans, operatives, or assistants.
                </p>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <CardTitle className="text-xl">Crew Optimisation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 leading-relaxed">
                  Instantly see spare capacity ("free labour"), under-used vehicles, and depot-wide availability. Maximise efficiency and reduce wasted hours.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Flexible User Pricing</h2>
            <p className="text-slate-600 text-lg mb-8">
              Scalable plans for contractors of all sizes — no report fees, no per-job charges.
            </p>
            <div className="flex items-center justify-center gap-4">
              <span className={!isYearly ? "font-semibold text-slate-900" : "text-slate-500"}>Monthly</span>
              <Switch checked={isYearly} onCheckedChange={setIsYearly} />
              <span className={isYearly ? "font-semibold text-slate-900" : "text-slate-500"}>Yearly <span className="text-green-600 text-sm font-bold">(Save 20%)</span></span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Starter */}
            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">Starter Team</CardTitle>
              </CardHeader>
              <CardContent className="text-center flex-1">
                {productsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <>
                    <div className="text-4xl font-bold text-slate-900 mb-1">
                      {formatPrice(getPrice(starterProduct, isYearly ? 'year' : 'month'))}
                    </div>
                    <div className="text-sm text-slate-500 mb-6">
                      {isYearly ? 'per year' : 'per month'}
                    </div>
                  </>
                )}
                <p className="text-sm text-slate-600 mb-4 italic">Perfect for small contractors and 1–5 person teams.</p>
                <Button 
                  variant="outline" 
                  className="w-full mb-6"
                  disabled={!starterProduct || checkoutLoading !== null}
                  onClick={() => {
                    const price = getPrice(starterProduct, isYearly ? 'year' : 'month');
                    if (price) handleCheckout(price.id, 30);
                  }}
                >
                  {checkoutLoading === getPrice(starterProduct, isYearly ? 'year' : 'month')?.id ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                  ) : (
                    'Start Free Trial'
                  )}
                </Button>
                <ul className="text-left space-y-3 text-sm text-slate-600">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Up to 5 Users</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Basic Scheduling</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 30-Day History</li>
                  <li className="flex items-center gap-2 font-semibold text-blue-600"><Check className="w-4 h-4 text-blue-600" /> 1-Month Free Trial</li>
                </ul>
              </CardContent>
            </Card>

            {/* Professional - Featured */}
            <Card className="border-blue-600 shadow-lg scale-105 z-10 flex flex-col relative bg-white">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                Most Popular
              </div>
              <CardHeader className="text-center pb-2 pt-8">
                <CardTitle className="text-xl">Professional</CardTitle>
              </CardHeader>
              <CardContent className="text-center flex-1">
                {productsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <>
                    <div className="text-4xl font-bold text-slate-900 mb-1">
                      {formatPrice(getPrice(proProduct, isYearly ? 'year' : 'month'))}
                    </div>
                    <div className="text-sm text-slate-500 mb-6">
                      {isYearly ? 'per year' : 'per month'}
                    </div>
                  </>
                )}
                <p className="text-sm text-slate-600 mb-4 italic">For growing drainage & civils teams needing automation and full visibility.</p>
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 mb-6"
                  disabled={!proProduct || checkoutLoading !== null}
                  onClick={() => {
                    const price = getPrice(proProduct, isYearly ? 'year' : 'month');
                    if (price) handleCheckout(price.id, 30);
                  }}
                >
                  {checkoutLoading === getPrice(proProduct, isYearly ? 'year' : 'month')?.id ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                  ) : (
                    'Get Started'
                  )}
                </Button>
                <ul className="text-left space-y-3 text-sm text-slate-600">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Unlimited Users</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Advanced AI Logic</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Conflict Detection & Alerts</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Full History Access</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Depot-Level Job Reporting</li>
                  <li className="flex items-center gap-2 font-semibold text-blue-600"><Check className="w-4 h-4 text-blue-600" /> 1-Month Free Trial</li>
                </ul>
              </CardContent>
            </Card>

            {/* Enterprise */}
            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">Enterprise</CardTitle>
              </CardHeader>
              <CardContent className="text-center flex-1">
                <div className="text-4xl font-bold text-slate-900 mb-1">Custom</div>
                <div className="text-sm text-slate-500 mb-6">contact sales</div>
                <p className="text-sm text-slate-600 mb-4 italic">For large contractors, multi-depot operations, or nationwide fleets.</p>
                <Button variant="outline" className="w-full mb-6">Contact Us</Button>
                <ul className="text-left space-y-3 text-sm text-slate-600">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Dedicated Support Team</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Custom API Integrations</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> White-Label Options</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Priority Feature Development</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-8">
          <div>
            <h4 className="text-white font-bold text-lg mb-4">Sewer Swarm AI</h4>
            <p className="text-sm">Revolutionizing utility scheduling with intelligent resource management.</p>
            <p className="text-xs mt-4 text-slate-500">Built for the UK Drainage, Civils & Utilities Industry</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#features" className="hover:text-white">Features</a></li>
              <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
              <li><Link href="/schedule" className="hover:text-white">Scheduling</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white">About Us</a></li>
              <li><a href="#" className="hover:text-white">Contact</a></li>
              <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Connect</h4>
            <p className="text-sm mb-4">Follow us for updates on AI scheduling features.</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-slate-800 text-center text-xs">
          &copy; 2025 Sewer Swarm AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
