import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function useUpgrade() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    
    try {
      // Fetch Pro product price
      const productsRes = await fetch("/api/stripe/products");
      if (!productsRes.ok) {
        throw new Error("Failed to fetch products");
      }
      
      const { data: products } = await productsRes.json();
      const proProduct = products.find((p: any) => p.metadata?.tier === "pro");
      
      if (!proProduct) {
        throw new Error("Pro plan not available");
      }
      
      // Get annual price (preferred) or monthly
      const annualPrice = proProduct.prices.find((p: any) => p.recurring?.interval === "year");
      const monthlyPrice = proProduct.prices.find((p: any) => p.recurring?.interval === "month");
      const priceId = annualPrice?.id || monthlyPrice?.id;
      
      if (!priceId) {
        throw new Error("No price available for Pro plan");
      }
      
      // Create checkout session
      const checkoutRes = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          priceId,
          trialDays: 0, // No trial for upgrades
        }),
      });
      
      if (!checkoutRes.ok) {
        const error = await checkoutRes.json();
        throw new Error(error.error || "Failed to create checkout session");
      }
      
      const { url } = await checkoutRes.json();
      
      if (url) {
        // Redirect to Stripe checkout
        window.location.href = url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error: any) {
      toast({
        title: "Upgrade failed",
        description: error.message || "Failed to start upgrade process",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return { handleUpgrade, loading };
}
