/**
 * Linera Adapter - Singleton managing all Linera blockchain interactions
 * 
 * This is the single point of contact with @linera/client.
 * Connects to Linera Conway Testnet using the faucet URL.
 * 
 * Based on Linera-Arcade's proven approach:
 * - NO localhost:8080 service required
 * - Uses @linera/client WASM to connect directly to faucet
 * - Claims a microchain for each user
 * - Auto-signing with ephemeral keys
 */

import type { Wallet as DynamicWallet } from '@dynamic-labs/sdk-react-core';
import { ensureWasmInitialized } from './wasmInit';
import { DynamicSigner } from './dynamicSigner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LineraClientModule = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Faucet = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Wallet = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Application = any;

// Cached module reference
let lineraClientModule: LineraClientModule | null = null;

/**
 * Dynamically load the @linera/client module
 */
async function getLineraClient(): Promise<LineraClientModule> {
  if (lineraClientModule) return lineraClientModule;
  try {
    lineraClientModule = await import('@linera/client');
    return lineraClientModule;
  } catch (error) {
    console.error('❌ Failed to load @linera/client:', error);
    throw error;
  }
}

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

// Faucet URL - This is the KEY endpoint for connecting to Conway testnet
// NO need for port 8080 or external GraphQL endpoints!
const DEFAULT_FAUCET_URL = import.meta.env.VITE_LINERA_FAUCET_URL || 'https://faucet.testnet-conway.linera.net';

// Application ID (from your deployment)
const APPLICATION_ID = import.meta.env.VITE_LINERA_APP_ID || import.meta.env.VITE_APPLICATION_ID || '';

// Hub Chain ID - WHERE THE APPLICATION STATE LIVES
// This is the chain where the application was originally deployed
// All tournament data lives on this chain, not on user chains!
const HUB_CHAIN_ID = import.meta.env.VITE_LINERA_CHAIN_ID || '';

// Validate APPLICATION_ID at module load (warning only)
if (!APPLICATION_ID || APPLICATION_ID === '' || APPLICATION_ID === 'placeholder') {
  console.warn('⚠️ VITE_LINERA_APP_ID is not set. Blockchain features may be limited.');
}

// Validate HUB_CHAIN_ID at module load (warning only)
if (!HUB_CHAIN_ID || HUB_CHAIN_ID === '') {
  console.warn('⚠️ VITE_LINERA_CHAIN_ID (hub chain) is not set. Application queries may fail.');
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Connection state after wallet connect
 */
export interface LineraConnection {
  client: Client;
  wallet: Wallet;
  faucet: Faucet;
  chainId: string;
  address: string;
  signer: DynamicSigner;
  autoSignerAddress: string;
}

/**
 * Application connection state
 */
export interface ApplicationConnection {
  application: Application;
  applicationId: string;
}

/**
 * Listener callback for state changes
 */
type StateChangeListener = () => void;

// =============================================================================
// LINERA ADAPTER CLASS
// =============================================================================

/**
 * LineraAdapter - Singleton class managing Linera connections
 */
class LineraAdapterClass {
  private static instance: LineraAdapterClass | null = null;
  
  private connection: LineraConnection | null = null;
  private appConnection: ApplicationConnection | null = null;
  private connectPromise: Promise<LineraConnection> | null = null;
  private listeners: Set<StateChangeListener> = new Set();

  private constructor() {
    console.log('🎮 LineraAdapter initialized');
    console.log(`   Faucet URL: ${DEFAULT_FAUCET_URL}`);
    console.log(`   Application ID: ${APPLICATION_ID?.slice(0, 16)}...`);
    console.log(`   Hub Chain ID: ${HUB_CHAIN_ID?.slice(0, 16)}...`);
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): LineraAdapterClass {
    if (!LineraAdapterClass.instance) {
      LineraAdapterClass.instance = new LineraAdapterClass();
    }
    return LineraAdapterClass.instance;
  }

  // ===========================================================================
  // CONNECTION METHODS
  // ===========================================================================

  /**
   * Connect to Linera network using Dynamic wallet
   * 
   * This:
   * 1. Initializes WASM
   * 2. Connects to Conway faucet
   * 3. Creates a Linera wallet
   * 4. Claims a microchain for the user's EVM address
   * 5. Sets up auto-signing
   */
  async connect(
    dynamicWallet: DynamicWallet,
    faucetUrl: string = DEFAULT_FAUCET_URL
  ): Promise<LineraConnection> {
    const userAddress = dynamicWallet.address?.toLowerCase();
    
    if (!userAddress) {
      throw new Error('Dynamic wallet has no address');
    }

    // If already connected with same address, return existing
    if (this.connection && this.connection.address === userAddress) {
      console.log('✅ Already connected to Linera');
      return this.connection;
    }

    // If connection in progress, wait for it
    if (this.connectPromise) {
      console.log('⏳ Connection in progress, waiting...');
      return this.connectPromise;
    }

    // Start new connection
    this.connectPromise = this.performConnect(dynamicWallet, faucetUrl, userAddress);
    
    try {
      const connection = await this.connectPromise;
      return connection;
    } finally {
      this.connectPromise = null;
    }
  }

  /**
   * Internal connection implementation
   */
  private async performConnect(
    dynamicWallet: DynamicWallet,
    faucetUrl: string,
    userAddress: string
  ): Promise<LineraConnection> {
    try {
      console.log('🔄 Connecting to Linera Conway Testnet...');
      
      // Step 1: Initialize WASM (CRITICAL - must call initialize() first)
      await ensureWasmInitialized();
      
      // Step 2: Load @linera/client module
      const lineraModule = await getLineraClient();
      const { Faucet, Client, signer: signerModule } = lineraModule;
      
      // Step 3: Connect to faucet
      console.log(`📡 Connecting to faucet: ${faucetUrl}`);
      const faucet = new Faucet(faucetUrl);
      
      // Step 4: Create Linera wallet from faucet
      console.log('👛 Creating Linera wallet...');
      const wallet = await faucet.createWallet();
      
      // Step 5: Claim a microchain for the user's EVM address
      console.log(`⛓️ Claiming microchain for ${userAddress}...`);
      const chainId = await faucet.claimChain(wallet, userAddress);
      console.log(`✅ Claimed chain: ${chainId}`);
      
      // Step 6: Create signers for auto-signing
      // - DynamicSigner: for user-initiated actions (requires wallet popup)
      // - AutoSigner: random in-memory key for automatic signing (no popup)
      console.log('🔑 Setting up auto-signing...');
      const dynamicSigner = new DynamicSigner(dynamicWallet);
      
      // Create auto-signer using PrivateKey.createRandom() - per Linera-Arcade pattern
      const autoSigner = signerModule.PrivateKey.createRandom();
      const autoSignerAddress = autoSigner.address();
      console.log(`   Auto-signer address: ${autoSignerAddress}`);
      
      // Step 7: Create composite signer (tries auto-signer first, falls back to dynamic)
      // Composite tries each signer in order until one has the key
      const compositeSigner = new signerModule.Composite(autoSigner, dynamicSigner);
      
      // Step 8: Create Linera client with composite signer
      console.log('🔗 Creating Linera client with auto-signing...');
      const clientResult = new Client(wallet, compositeSigner);
      const client = await clientResult;
      
      // Step 9: Connect to chain and add auto-signer as owner
      console.log('⛓️ Connecting to chain...');
      const chain = await client.chain(chainId);
      
      // Add auto-signer as chain owner (requires ONE wallet signature)
      console.log('✍️ Adding auto-signer as chain owner (one-time signature)...');
      await chain.addOwner(autoSignerAddress);
      
      // Set auto-signer as default owner for automatic operations
      await wallet.setOwner(chainId, autoSignerAddress);
      console.log('✅ Auto-signing enabled!');
      
      // Store connection
      this.connection = {
        client,
        wallet,
        faucet,
        chainId,
        address: userAddress,
        signer: dynamicSigner,
        autoSignerAddress,
      };
      
      console.log('✅ Connected to Linera Conway Testnet successfully with auto-signing!');
      console.log(`   Chain ID: ${chainId}`);
      console.log(`   Address: ${userAddress}`);
      console.log(`   Auto-Signer: ${autoSignerAddress}`);
      
      this.notifyListeners();
      return this.connection;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to connect to Linera:', message);
      this.connection = null;
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Connect to the Labyrinth Legends application
   */
  async connectApplication(
    applicationId: string = APPLICATION_ID
  ): Promise<ApplicationConnection> {
    if (!this.connection) {
      throw new Error('Must connect wallet before connecting to application');
    }

    if (!applicationId) {
      throw new Error('Application ID is not configured');
    }

    // If already connected to same application, return existing
    if (this.appConnection && this.appConnection.applicationId === applicationId) {
      console.log('✅ Already connected to application');
      return this.appConnection;
    }

    try {
      console.log(`🎮 Connecting to application: ${applicationId.slice(0, 16)}...`);
      
      // CRITICAL: Use HUB_CHAIN_ID for application queries!
      // The application state (tournaments, runs, etc.) lives on the hub chain,
      // not on the user's personal chain.
      const hubChainId = HUB_CHAIN_ID || this.connection.chainId;
      console.log(`⛓️ Using hub chain for application state: ${hubChainId.slice(0, 16)}...`);
      
      // Get hub chain instance and then application
      const chain = await this.connection.client.chain(hubChainId);
      const application = await chain.application(applicationId);
      
      // Set up notifications for real-time updates
      this.setupChainNotifications(chain);
      
      this.appConnection = {
        application,
        applicationId,
      };
      
      console.log('✅ Connected to Labyrinth Legends application!');
      this.notifyListeners();
      return this.appConnection;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to connect to application:', message);
      this.appConnection = null;
      this.notifyListeners();
      throw error;
    }
  }

  // ===========================================================================
  // QUERY/MUTATION METHODS
  // ===========================================================================

  /**
   * Execute a GraphQL query against the application
   */
  async query<T = unknown>(
    graphqlQuery: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    if (!this.appConnection) {
      throw new Error('Must connect to application before querying');
    }

    const payload = variables
      ? { query: graphqlQuery, variables }
      : { query: graphqlQuery };

    try {
      console.log('📤 Sending query...');
      const result = await this.appConnection.application.query(
        JSON.stringify(payload)
      );
      
      const parsed = JSON.parse(result);
      
      if (parsed.errors && parsed.errors.length > 0) {
        throw new Error(parsed.errors[0].message || 'GraphQL error');
      }
      
      return parsed.data as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Query failed:', message);
      throw error;
    }
  }

  /**
   * Execute a GraphQL mutation against the application.
   * This triggers a blockchain transaction that requires wallet signing.
   * 
   * In Linera, mutations use the same interface as queries - 
   * the client handles distinguishing based on GraphQL operation type.
   * 
   * @param graphqlMutation - GraphQL mutation string
   * @param variables - Optional variables for the mutation
   * @returns Parsed JSON response
   */
  async mutate<T = unknown>(
    graphqlMutation: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    // Mutations use the same interface as queries in Linera
    // The client handles distinguishing based on GraphQL operation type
    return this.query<T>(graphqlMutation, variables);
  }

  // ===========================================================================
  // STATE MANAGEMENT
  // ===========================================================================

  private setupChainNotifications(chain: { onNotification: (handler: (notification: unknown) => void) => void }): void {
    try {
      chain.onNotification((notification: unknown) => {
        const notif = notification as { reason?: { NewBlock?: unknown } };
        if (notif.reason?.NewBlock) {
          console.log('📦 New block received');
          this.notifyListeners();
        }
      });
    } catch (error) {
      console.warn('⚠️ Could not set up notifications:', error);
    }
  }

  isConnected(): boolean {
    return this.connection !== null;
  }

  isApplicationConnected(): boolean {
    return this.appConnection !== null;
  }

  getConnection(): LineraConnection | null {
    return this.connection;
  }

  getApplicationConnection(): ApplicationConnection | null {
    return this.appConnection;
  }

  getAddress(): string | null {
    return this.connection?.address ?? null;
  }

  getChainId(): string | null {
    return this.connection?.chainId ?? null;
  }

  getAutoSignerAddress(): string | null {
    return this.connection?.autoSignerAddress ?? null;
  }

  getApplicationId(): string | null {
    return this.appConnection?.applicationId ?? null;
  }

  disconnect(): void {
    console.log('🔌 Disconnecting from Linera...');
    this.connection = null;
    this.appConnection = null;
    this.connectPromise = null;
    this.notifyListeners();
  }

  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }
}

// Export singleton instance
export const lineraAdapter = LineraAdapterClass.getInstance();
export { LineraAdapterClass };
