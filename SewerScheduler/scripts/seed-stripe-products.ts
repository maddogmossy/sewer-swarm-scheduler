import { getUncachableStripeClient } from '../server/stripeClient';

async function seedProducts() {
  console.log('Creating Stripe products and prices...');
  
  try {
    const stripe = await getUncachableStripeClient();
    
    // Check if products already exist
    const existingProducts = await stripe.products.search({ 
      query: "name:'Sewer Swarm Pro'" 
    });
    
    if (existingProducts.data.length > 0) {
      console.log('Products already exist, skipping seed.');
      console.log('Existing products:');
      for (const product of existingProducts.data) {
        console.log(`  - ${product.name} (${product.id})`);
      }
      return;
    }
    
    // Create the main subscription product
    const proProduct = await stripe.products.create({
      name: 'Sewer Swarm Pro',
      description: 'Full access for larger teams. Up to 30 crews, 250 employees, and unlimited depots with approval workflow.',
      metadata: {
        features: 'Unlimited depots,Up to 30 crews,Up to 250 employees,Up to 100 vehicles,Drag-and-drop scheduling,Email notifications,Smart search,Conflict detection,Approval workflow',
        tier: 'pro',
        depot_limit: '999',
        crew_limit: '30',
        employee_limit: '250',
        vehicle_limit: '100',
        requires_approval: 'true',
      },
    });
    console.log(`Created product: ${proProduct.name} (${proProduct.id})`);
    
    // Create monthly price
    const monthlyPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 4900, // £49.00
      currency: 'gbp',
      recurring: { interval: 'month' },
      metadata: {
        display_name: 'Monthly',
      },
    });
    console.log(`Created monthly price: £${monthlyPrice.unit_amount! / 100}/month (${monthlyPrice.id})`);
    
    // Create annual price with discount
    const annualPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 47000, // £470.00 (save £118/year - ~20% off)
      currency: 'gbp',
      recurring: { interval: 'year' },
      metadata: {
        display_name: 'Annual',
        savings: '20%',
      },
    });
    console.log(`Created annual price: £${annualPrice.unit_amount! / 100}/year (${annualPrice.id})`);
    
    // Create a starter tier
    const starterProduct = await stripe.products.create({
      name: 'Sewer Swarm Starter',
      description: 'Perfect for small teams. 1 depot, up to 3 crews, 25 employees with auto-approval.',
      metadata: {
        features: '1 depot,Up to 3 crews,Up to 25 employees,Up to 10 vehicles,Drag-and-drop scheduling,Email notifications,Auto-approval',
        tier: 'starter',
        depot_limit: '1',
        crew_limit: '3',
        employee_limit: '25',
        vehicle_limit: '10',
        requires_approval: 'false',
      },
    });
    console.log(`Created product: ${starterProduct.name} (${starterProduct.id})`);
    
    // Create starter monthly price
    const starterMonthlyPrice = await stripe.prices.create({
      product: starterProduct.id,
      unit_amount: 2900, // £29.00
      currency: 'gbp',
      recurring: { interval: 'month' },
      metadata: {
        display_name: 'Monthly',
      },
    });
    console.log(`Created starter monthly price: £${starterMonthlyPrice.unit_amount! / 100}/month (${starterMonthlyPrice.id})`);
    
    // Create starter annual price
    const starterAnnualPrice = await stripe.prices.create({
      product: starterProduct.id,
      unit_amount: 27900, // £279.00 (save £69/year - ~20% off)
      currency: 'gbp',
      recurring: { interval: 'year' },
      metadata: {
        display_name: 'Annual',
        savings: '20%',
      },
    });
    console.log(`Created starter annual price: £${starterAnnualPrice.unit_amount! / 100}/year (${starterAnnualPrice.id})`);
    
    console.log('\n✅ Products and prices created successfully!');
    console.log('\nProduct IDs for reference:');
    console.log(`  Starter: ${starterProduct.id}`);
    console.log(`  Pro: ${proProduct.id}`);
    console.log('\nPrice IDs for checkout:');
    console.log(`  Starter Monthly: ${starterMonthlyPrice.id}`);
    console.log(`  Starter Annual: ${starterAnnualPrice.id}`);
    console.log(`  Pro Monthly: ${monthlyPrice.id}`);
    console.log(`  Pro Annual: ${annualPrice.id}`);
    
  } catch (error: any) {
    console.error('Failed to seed products:', error.message);
    process.exit(1);
  }
}

seedProducts();
