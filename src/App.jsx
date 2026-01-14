import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import logo from './assets/logo.png'; 
import './App.css';
import { CopyToClipboard } from 'react-copy-to-clipboard';

// Icons dari lucide-react
import { Copy, Search, RefreshCw, Wind, Droplets, Activity, Globe, ExternalLink, Fingerprint, ArrowUp, ArrowDown, Calendar, Clock, Wallet, TrendingUp, TrendingDown, Filter, ChevronDown, ChevronUp } from 'lucide-react';

// Contract ABI - SESUAI DENGAN SMART CONTRACT YANG BARU
const contractABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function taxFee() view returns (uint256)",
  "function setTaxFee(uint256 newTaxFee)",
  "function mint(address to, uint256 amount)",
  "function burn(uint256 amount)",
  "function pause()",
  "function unpause()",
  "function blacklist(address account)",
  "function unblacklist(address account)",
  "function isBlacklisted(address account) view returns (bool)",
  "function getAllTokenHolders() view returns (address[], uint256[])",
  "function getHoldersCount() view returns (uint256)",
  "function getTagline() view returns (string)",
  "function updateTagline(string memory newTagline)",
  "function getTokenInfo() view returns (string, string, uint256, uint256, uint256, string, address)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

// RPC Configuration
const RPC_URL = "https://ethereum-sepolia.publicnode.com";
// GANTI DENGAN ALAMAT KONTRAK O2 YANG BARU
const CONTRACT_ADDRESS = "0xc3995327C271697C468a5bc03E708D43Ba07BEA4"; // Update setelah deploy

// Blockchain Explorer URL
const BLOCKCHAIN_EXPLORER_URL = `https://eth-sepolia.blockscout.com/token/${CONTRACT_ADDRESS}?tab=contract`;

// Fungsi untuk memformat angka dengan pemisah ribuan
const formatNumber = (num) => {
  if (!num) return '0';
  
  // Jika input adalah string, konversi ke number
  const number = typeof num === 'string' ? parseFloat(num) : num;
  
  // Pisah bagian integer dan desimal
  const parts = number.toString().split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] || '';
  
  // Format integer part dengan pemisah ribuan
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Gabungkan dengan desimal jika ada
  return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger;
};

// Fungsi untuk memformat saldo dengan presisi tinggi
const formatBalance = (balance, decimals = 4) => {
  try {
    if (!balance || balance === '0') return '0';
    
    const balanceNumber = parseFloat(balance);
    
    // Jika saldo sangat kecil (< 0.0001), tampilkan dengan notasi ilmiah
    if (balanceNumber < 0.0001 && balanceNumber > 0) {
      return balanceNumber.toExponential(6);
    }
    
    // Untuk saldo normal, format dengan desimal
    const options = {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
      useGrouping: true
    };
    
    return balanceNumber.toLocaleString('id-ID', options);
  } catch (error) {
    return balance;
  }
};

// Fungsi untuk memformat timestamp ke tanggal dan waktu
const formatTimestamp = (timestamp) => {
  if (!timestamp || timestamp === 0) return '-';
  
  const date = new Date(timestamp * 1000);
  
  // Format tanggal
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  // Format waktu
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  
  return {
    date: `${day}/${month}/${year}`,
    time: `${hours}:${minutes}:${seconds}`,
    full: `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
  };
};

const App = () => {
  // State utama
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [balance, setBalance] = useState('0');
  const [isOwner, setIsOwner] = useState(false);
  
  // State untuk transfer
  const [recipient, setRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  
  // State untuk token info
  const [tokenInfo, setTokenInfo] = useState({
    name: '',
    symbol: '',
    totalSupply: '',
    taxFee: '',
    owner: ''
  });
  const [tagline, setTagline] = useState('Oxygen is Vital. Never Sell. It\'s Not About Riches, It\'s About Wealth');
  
  // State untuk holders
  const [holders, setHolders] = useState([]);
  const [loadingHolders, setLoadingHolders] = useState(false);
  const [filteredHolders, setFilteredHolders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllHolders, setShowAllHolders] = useState(false);
  const [holdersCount, setHoldersCount] = useState(0);
  
  // State untuk Lacak Transaksi
  const [trackAddress, setTrackAddress] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all'); // 'all', 'incoming', 'outgoing'
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false); // State baru untuk toggle show all
  
  // State lainnya
  const [newTagline, setNewTagline] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showLogoAnimation, setShowLogoAnimation] = useState(false);
  const [splashOpacity, setSplashOpacity] = useState(1);
  const [copiedAddress, setCopiedAddress] = useState(null);
  
  const eventListenerRef = useRef(null);

  // Initialize provider
  useEffect(() => {
    const initProvider = async () => {
      try {
        let web3Provider;
        
        if (window.ethereum) {
          web3Provider = new ethers.BrowserProvider(window.ethereum);
        } else {
          web3Provider = new ethers.JsonRpcProvider(RPC_URL);
        }
        
        setProvider(web3Provider);
        const tokenContract = new ethers.Contract(
          CONTRACT_ADDRESS,
          contractABI,
          web3Provider
        );
        setContract(tokenContract);
        await loadTokenInfo(tokenContract);
        
        // Load holders saat pertama kali
        await loadAllTokenHolders(tokenContract);
        
      } catch (error) {
        console.error("Error initializing provider:", error);
      }
    };
    
    initProvider();
    
    // Splash screen timing
    const splashTimer1 = setTimeout(() => {
      setShowLogoAnimation(true);
    }, 8000);
    
    const splashTimer2 = setTimeout(() => {
      setSplashOpacity(0);
    }, 12000);
    
    const splashTimer3 = setTimeout(() => {
      setShowSplash(false);
    }, 14000);
    
    // Cleanup event listener
    return () => {
      if (eventListenerRef.current && window.ethereum) {
        window.ethereum.removeListener('accountsChanged', eventListenerRef.current);
        window.ethereum.removeListener('chainChanged', eventListenerRef.current);
      }
      clearTimeout(splashTimer1);
      clearTimeout(splashTimer2);
      clearTimeout(splashTimer3);
    };
  }, []);

  // Setup event listener untuk perubahan akun dan saldo
  useEffect(() => {
    if (window.ethereum && contract && account) {
      const handleAccountsChanged = async (accounts) => {
        if (accounts.length > 0) {
          const newAccount = accounts[0];
          setAccount(newAccount);
          await loadBalance(newAccount, contract);
          
          // Check if still owner
          const ownerAddress = await contract.owner();
          setIsOwner(ownerAddress.toLowerCase() === newAccount.toLowerCase());
          
          // Jika ada address yang sedang di-track, refresh transaksi
          if (trackAddress) {
            await loadTransactionHistory(trackAddress);
          }
        } else {
          setAccount('');
          setBalance('0');
          setIsOwner(false);
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      // Listen untuk Transfer event untuk update real-time
      const transferFilter = contract.filters.Transfer();
      contract.on(transferFilter, async (from, to, value, event) => {
        console.log('Transfer event detected:', { from, to, value });
        
        // Refresh balance jika user terlibat
        if (account && (from.toLowerCase() === account.toLowerCase() || 
            to.toLowerCase() === account.toLowerCase())) {
          await loadBalance(account, contract);
        }
        
        // Refresh holders list
        await loadAllTokenHolders(contract);
        
        // Refresh transaction history jika sedang track address yang terlibat
        if (trackAddress && (from.toLowerCase() === trackAddress.toLowerCase() || 
            to.toLowerCase() === trackAddress.toLowerCase())) {
          await loadTransactionHistory(trackAddress);
        }
        
        // Tambahkan transaksi baru ke state jika perlu
        const newTransaction = {
          hash: event.transactionHash,
          from: from,
          to: to,
          value: ethers.formatUnits(value, await contract.decimals()),
          timestamp: Date.now() / 1000, // Approximate timestamp
          blockNumber: event.blockNumber,
          type: from.toLowerCase() === trackAddress?.toLowerCase() ? 'outgoing' : 
                to.toLowerCase() === trackAddress?.toLowerCase() ? 'incoming' : 'other'
        };
        
        // Simpan maksimal 100 transaksi terbaru
        setTransactions(prev => [newTransaction, ...prev].slice(0, 100));
      });

      // Setup event listeners
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      
      eventListenerRef.current = handleAccountsChanged;
      
      return () => {
        contract.off(transferFilter);
      };
    }
  }, [contract, account, trackAddress]);

  // Filter holders berdasarkan search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredHolders(holders);
    } else {
      const filtered = holders.filter(holder =>
        holder.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        holder.formattedAddress.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredHolders(filtered);
    }
  }, [searchTerm, holders]);

  // Filter transactions berdasarkan type dan limit ke 3 transaksi terbaru
  const filteredTransactions = React.useMemo(() => {
    let filtered = transactions;
    
    // Filter berdasarkan type
    if (transactionTypeFilter !== 'all') {
      filtered = filtered.filter(tx => tx.type === transactionTypeFilter);
    }
    
    return filtered;
  }, [transactions, transactionTypeFilter]);

  // Ambil hanya 3 transaksi terbaru untuk ditampilkan (kecuali jika showAllTransactions true)
  const displayedTransactions = React.useMemo(() => {
    if (showAllTransactions) {
      return filteredTransactions;
    }
    // Ambil hanya 3 transaksi terbaru
    return filteredTransactions.slice(0, 3);
  }, [filteredTransactions, showAllTransactions]);

  // Hitung jumlah transaksi yang lebih dari 3
  const hasMoreTransactions = filteredTransactions.length > 3;

  const loadTokenInfo = async (contractInstance) => {
    try {
      const name = await contractInstance.name();
      const symbol = await contractInstance.symbol();
      const totalSupply = await contractInstance.totalSupply();
      const decimals = await contractInstance.decimals();
      const taxFee = await contractInstance.taxFee();
      const tagline = await contractInstance.getTagline();
      const owner = await contractInstance.owner();
      
      setTokenInfo({
        name,
        symbol,
        totalSupply: ethers.formatUnits(totalSupply, decimals),
        taxFee: ethers.formatUnits(taxFee, 2) + '%',
        owner
      });
      
      setTagline(tagline);
      
    } catch (error) {
      console.error("Error loading token info:", error);
    }
  };

  // Fungsi untuk load semua token holders
  const loadAllTokenHolders = async (contractInstance) => {
    try {
      setLoadingHolders(true);
      
      // Gunakan fungsi getAllTokenHolders dari smart contract
      const [addresses, balances] = await contractInstance.getAllTokenHolders();
      const decimals = await contractInstance.decimals();
      
      const holdersList = [];
      
      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        const balanceWei = balances[i];
        const balanceFormatted = ethers.formatUnits(balanceWei, decimals);
        
        holdersList.push({
          address: address,
          formattedAddress: `${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
          balance: balanceFormatted,
          balanceFormatted: formatBalance(balanceFormatted, 4)
        });
      }
      
      // Urutkan dari saldo terbesar ke terkecil
      holdersList.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));
      
      setHolders(holdersList);
      setFilteredHolders(holdersList);
      
      // Get holders count
      const count = await contractInstance.getHoldersCount();
      setHoldersCount(Number(count));
      
    } catch (error) {
      console.error("Error loading token holders:", error);
      // Fallback: coba load dari events jika fungsi tidak tersedia
      await loadHoldersFromEvents(contractInstance);
    } finally {
      setLoadingHolders(false);
    }
  };

  // Fallback function jika getAllTokenHolders tidak tersedia
  const loadHoldersFromEvents = async (contractInstance) => {
    try {
      const filter = contractInstance.filters.Transfer();
      const events = await contractInstance.queryFilter(filter, 0, 'latest');
      
      const balancesMap = new Map();
      const decimals = await contractInstance.decimals();
      
      events.forEach(event => {
        const { from, to, value } = event.args;
        const valueNum = Number(ethers.formatUnits(value, decimals));
        
        if (from !== ethers.ZeroAddress) {
          const fromBalance = balancesMap.get(from) || 0;
          balancesMap.set(from, fromBalance - valueNum);
        }
        
        const toBalance = balancesMap.get(to) || 0;
        balancesMap.set(to, toBalance + valueNum);
      });
      
      const holdersList = [];
      balancesMap.forEach((balance, address) => {
        if (balance > 0) {
          holdersList.push({
            address: address,
            formattedAddress: `${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
            balance: balance.toFixed(4),
            balanceFormatted: formatBalance(balance.toFixed(4), 4)
          });
        }
      });
      
      holdersList.sort((a, b) => b.balance - a.balance);
      setHolders(holdersList);
      setFilteredHolders(holdersList);
      setHoldersCount(holdersList.length);
      
    } catch (error) {
      console.error("Error loading holders from events:", error);
    }
  };

  // Fungsi untuk load transaction history dari event logs
  const loadTransactionHistory = async (address) => {
    if (!contract || !address) return;
    
    try {
      setLoadingTransactions(true);
      
      // Dapatkan semua Transfer events
      const filter = contract.filters.Transfer();
      const events = await contract.queryFilter(filter, 0, 'latest');
      
      const decimals = await contract.decimals();
      const transactionList = [];
      
      // Filter events yang melibatkan address yang dicari
      for (const event of events) {
        const { from, to, value } = event.args;
        
        if (from.toLowerCase() === address.toLowerCase() || 
            to.toLowerCase() === address.toLowerCase()) {
          
          const block = await event.getBlock();
          
          transactionList.push({
            hash: event.transactionHash,
            from: from,
            to: to,
            value: ethers.formatUnits(value, decimals),
            timestamp: block.timestamp,
            blockNumber: block.number,
            type: from.toLowerCase() === address.toLowerCase() ? 'outgoing' : 'incoming'
          });
        }
      }
      
      // Urutkan berdasarkan timestamp terbaru di atas
      transactionList.sort((a, b) => b.timestamp - a.timestamp);
      
      setTransactions(transactionList);
      
    } catch (error) {
      console.error("Error loading transaction history:", error);
      alert('Gagal memuat riwayat transaksi: ' + error.message);
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Fungsi untuk melacak transaksi berdasarkan address
  const handleTrackTransactions = async () => {
    if (!trackAddress.trim()) {
      alert('Masukkan alamat wallet untuk melacak transaksi');
      return;
    }
    
    // Validasi format address
    if (!ethers.isAddress(trackAddress)) {
      alert('Format alamat tidak valid. Harap masukkan alamat wallet yang valid.');
      return;
    }
    
    await loadTransactionHistory(trackAddress);
    setShowTransactionDetails(true);
    setShowAllTransactions(false); // Reset ke tampilan 3 transaksi saat melacak baru
  };

  // Fungsi untuk menggunakan address saat ini (jika wallet terkoneksi)
  const useCurrentAddress = () => {
    if (account) {
      setTrackAddress(account);
    }
  };

  // Fungsi untuk mengosongkan pencarian transaksi
  const clearTransactionSearch = () => {
    setTrackAddress('');
    setTransactions([]);
    setShowTransactionDetails(false);
    setTransactionTypeFilter('all');
    setShowAllTransactions(false); // Reset toggle
  };

  // Fungsi untuk toggle show all transactions
  const toggleShowAllTransactions = () => {
    setShowAllTransactions(!showAllTransactions);
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask!');
        return;
      }
      
      setIsLoading(true);
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const signerInstance = await web3Provider.getSigner();
      const userAccount = accounts[0];
      
      setAccount(userAccount);
      setSigner(signerInstance);
      
      const contractWithSigner = contract.connect(signerInstance);
      setContract(contractWithSigner);
      
      const ownerAddress = await contractWithSigner.owner();
      setIsOwner(ownerAddress.toLowerCase() === userAccount.toLowerCase());
      
      await loadBalance(userAccount, contractWithSigner);
      
    } catch (error) {
      console.error("Error connecting wallet:", error);
      alert('Failed to connect wallet: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBalance = async (address, contractInstance) => {
    try {
      const balance = await contractInstance.balanceOf(address);
      const decimals = await contractInstance.decimals();
      const formattedBalance = ethers.formatUnits(balance, decimals);
      setBalance(formattedBalance);
    } catch (error) {
      console.error("Error loading balance:", error);
    }
  };

  const handleTransfer = async (toOwner = false) => {
    try {
      if (!contract || !signer) {
        alert('Please connect wallet first');
        return;
      }
      
      setIsLoading(true);
      const decimals = await contract.decimals();
      const amount = ethers.parseUnits(transferAmount, decimals);
      let recipientAddress = recipient;
      
      if (toOwner) {
        recipientAddress = await contract.owner();
      }
      
      if (!recipientAddress) {
        alert('Please enter recipient address');
        return;
      }
      
      const tx = await contract.transfer(recipientAddress, amount);
      await tx.wait();
      
      alert('Transfer successful!');
      
      // Refresh data setelah transfer
      await loadBalance(account, contract);
      await loadAllTokenHolders(contract);
      
      // Jika address yang ditrack adalah pengirim atau penerima, refresh transaksi
      if (trackAddress && (trackAddress.toLowerCase() === account.toLowerCase() || 
          trackAddress.toLowerCase() === recipientAddress.toLowerCase())) {
        await loadTransactionHistory(trackAddress);
      }
      
      setTransferAmount('');
      if (!toOwner) setRecipient('');
      
    } catch (error) {
      console.error("Transfer error:", error);
      alert('Transfer failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyAddress = (address) => {
    navigator.clipboard.writeText(address)
      .then(() => {
        setCopiedAddress(address);
        setTimeout(() => setCopiedAddress(null), 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        // Fallback untuk browser lama
        const textArea = document.createElement('textarea');
        textArea.value = address;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        setCopiedAddress(address);
        setTimeout(() => setCopiedAddress(null), 2000);
      });
  };

  const handleMint = async () => {
    try {
      if (!isOwner) {
        alert('Only owner can mint tokens');
        return;
      }
      
      const amount = prompt('Enter amount to mint:');
      if (!amount) return;
      
      setIsLoading(true);
      const decimals = await contract.decimals();
      const mintAmount = ethers.parseUnits(amount, decimals);
      
      const tx = await contract.mint(account, mintAmount);
      await tx.wait();
      
      alert('Mint successful!');
      
      // Refresh data setelah mint
      await loadBalance(account, contract);
      await loadAllTokenHolders(contract);
      
      // Refresh transaction history jika address yang ditrack adalah owner
      if (trackAddress && trackAddress.toLowerCase() === account.toLowerCase()) {
        await loadTransactionHistory(trackAddress);
      }
      
    } catch (error) {
      console.error("Mint error:", error);
      alert('Mint failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBurn = async () => {
    try {
      if (!isOwner) {
        alert('Only owner can burn tokens');
        return;
      }
      
      const amount = prompt('Enter amount to burn:');
      if (!amount) return;
      
      setIsLoading(true);
      const decimals = await contract.decimals();
      const burnAmount = ethers.parseUnits(amount, decimals);
      
      const tx = await contract.burn(burnAmount);
      await tx.wait();
      
      alert('Burn successful!');
      
      // Refresh data setelah burn
      await loadBalance(account, contract);
      await loadAllTokenHolders(contract);
      
      // Refresh transaction history jika address yang ditrack adalah owner
      if (trackAddress && trackAddress.toLowerCase() === account.toLowerCase()) {
        await loadTransactionHistory(trackAddress);
      }
      
    } catch (error) {
      console.error("Burn error:", error);
      alert('Burn failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshHolders = async () => {
    if (contract) {
      await loadAllTokenHolders(contract);
    }
  };

  const handleUpdateTagline = async () => {
    try {
      if (!isOwner) {
        alert('Only owner can update the tagline');
        return;
      }
      
      if (!newTagline.trim()) {
        alert('Please enter a new tagline');
        return;
      }
      
      setIsLoading(true);
      const tx = await contract.updateTagline(newTagline);
      await tx.wait();
      
      alert('Tagline updated successfully!');
      setTagline(newTagline);
      setNewTagline('');
      
    } catch (error) {
      console.error("Tagline update error:", error);
      alert('Failed to update tagline: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Fungsi untuk membuka blockchain explorer
  const openBlockchainExplorer = () => {
    window.open(BLOCKCHAIN_EXPLORER_URL, '_blank', 'noopener,noreferrer');
  };

  // Fungsi untuk membuka transaksi di explorer
  const openTransactionInExplorer = (txHash) => {
    window.open(`https://eth-sepolia.blockscout.com/tx/${txHash}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      {/* Splash Screen */}
      {showSplash && (
        <div className="splash-screen" style={{ opacity: splashOpacity }}>
          <div className="splash-content">
            {!showLogoAnimation ? (
              <div className="tagline-container">
                <div className="tagline-background">
                  <img src={logo} alt="O2 Logo" className="splash-logo-large" />
                </div>
                <div className="splash-tagline">
                  <p>Oxygen is Vital. Never Sell.</p>
                  <p>It's Not About Riches, It's About Wealth</p>
                </div>
              </div>
            ) : (
              <div className="logo-animation-container">
                <div className="rotating-logo-wrapper">
                  <img src={logo} alt="O2 Logo" className="rotating-logo" />
                  <div className="logo-glow-effect"></div>
                </div>
                <div className="animated-tagline">
                  <span className="tagline-text">Oxygen is Vital.</span>
                  <span className="tagline-text">Never Sell.</span>
                  <span className="tagline-text tagline-highlight">It's Not About Riches</span>
                  <span className="tagline-text tagline-highlight">It's About Wealth</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Main App */}
      <div className="App" style={{ display: showSplash ? 'none' : 'block' }}>
        <header className="App-header">
          <div className="header-left">
            {/* Logo dan Title */}
            <div className="logo-title-container">
              <div className="logo-wrapper">
                <img src={logo} alt="O2 Token Logo" className="logo" />
                <div className="logo-glow"></div>
              </div>
              <div className="title-container">
                <h1>O2 Token</h1>
              </div>
            </div>
            
            <div className="tagline-display">
              <p className="current-tagline">"{tagline}"</p>
            </div>
            
            {/* Contract Address */}
            <div className="contract-address-container">
              <div className="contract-address-header">
                <div className="contract-address-left">
                  <Fingerprint size={16} className="fingerprint-icon" />
                  <span className="contract-label">View contract @ Blockchain</span>
                </div>
                <button 
                  onClick={openBlockchainExplorer}
                  className="explorer-link-btn"
                  title="View on Blockchain Explorer"
                >
                  <ExternalLink size={16} />
                </button>
              </div>
              <div className="contract-address">
                <span className="address-text">
                  {CONTRACT_ADDRESS.substring(0, 10)}...{CONTRACT_ADDRESS.substring(CONTRACT_ADDRESS.length - 8)}
                </span>
                <CopyToClipboard 
                  text={CONTRACT_ADDRESS} 
                  onCopy={() => handleCopyAddress(CONTRACT_ADDRESS)}
                >
                  <button 
                    className="copy-btn small"
                    disabled={isLoading}
                  >
                    <Copy size={14} /> Copy
                    {copiedAddress === CONTRACT_ADDRESS && (
                      <span className="copied-text">Copied!</span>
                    )}
                  </button>
                </CopyToClipboard>
              </div>
            </div>
          </div>
          
          <div className="wallet-section">
            {!account ? (
              <button 
                onClick={connectWallet} 
                className="connect-btn"
                disabled={isLoading}
              >
                <span className="wallet-icon">🌬️</span>
                {isLoading ? 'Connecting...' : 'Breathe Life (Connect Wallet)'}
              </button>
            ) : (
              <div className="account-info">
                <div className="status-badge">
                  {isOwner ? '👑 Oxygen Guardian' : '👤 Token Holder'}
                </div>
                <p className="account-address">
                  {account.substring(0, 6)}...{account.substring(account.length - 4)}
                  <CopyToClipboard 
                    text={account} 
                    onCopy={() => handleCopyAddress(account)}
                  >
                    <button className="copy-btn" disabled={isLoading}>
                      <Copy size={14} />
                    </button>
                  </CopyToClipboard>
                  {copiedAddress === account && <span className="copied-text">Copied!</span>}
                </p>
                <p className="token-balance">
                  <span className="balance-icon">🌬️</span>
                  Oxygen Balance: <span className="balance-amount">{formatBalance(balance, 4)}</span> O2
                </p>
              </div>
            )}
          </div>
        </header>

        <main className="App-main">
          {/* Token Information Section */}
          <section className="token-info">
            <h2>O2 Token Information</h2>
            <div className="info-grid">
              <div className="info-card oxygen-card">
                <Droplets size={24} className="info-icon" />
                <h3>Token Name</h3>
                <p className="oxygen-text">{tokenInfo.name}</p>
              </div>
              <div className="info-card oxygen-card">
                <Wind size={24} className="info-icon" />
                <h3>Symbol</h3>
                <p className="oxygen-text">{tokenInfo.symbol}</p>
              </div>
              <div className="info-card oxygen-card">
                <Globe size={24} className="info-icon" />
                <h3>Total Supply</h3>
                <p>{formatNumber(tokenInfo.totalSupply)} O2</p>
              </div>
              <div className="info-card oxygen-card">
                <Activity size={24} className="info-icon" />
                <h3>Tax Fee</h3>
                <p>{tokenInfo.taxFee} per transfer</p>
              </div>
            </div>
          </section>

          {/* Lacak Transaksi Section - BARU */}
          <section className="track-transactions-section">
            <h2> Lacak Transaksi</h2>
            
            <div className="track-transactions-form">
              <div className="track-input-group">
                <input
                  type="text"
                  placeholder="Masukkan alamat wallet (0x...)"
                  value={trackAddress}
                  onChange={(e) => setTrackAddress(e.target.value)}
                  className="track-address-input"
                  disabled={isLoading || loadingTransactions}
                />
                {account && (
                  <button 
                    onClick={useCurrentAddress}
                    className="use-current-btn"
                    disabled={isLoading}
                  >
                    <Wallet size={16} /> Gunakan Wallet Saya
                  </button>
                )}
              </div>
              
              <div className="track-buttons">
                <button 
                  onClick={handleTrackTransactions}
                  className="track-btn"
                  disabled={isLoading || loadingTransactions || !trackAddress.trim()}
                >
                  {loadingTransactions ? (
                    <>
                      <RefreshCw size={16} className="spinning" /> Memuat...
                    </>
                  ) : (
                    <>
                      <Search size={16} /> Lacak Transaksi
                    </>
                  )}
                </button>
                
                {showTransactionDetails && (
                  <button 
                    onClick={clearTransactionSearch}
                    className="clear-track-btn"
                    disabled={isLoading}
                  >
                    × Hapus Pencarian
                  </button>
                )}
              </div>
            </div>
            
            {/* Transaction History */}
            {showTransactionDetails && (
              <div className="transaction-history">
                <div className="transaction-header">
                  <h3>
                    Riwayat Transaksi untuk: 
                    <span className="tracked-address">
                      {trackAddress.substring(0, 8)}...{trackAddress.substring(trackAddress.length - 6)}
                    </span>
                    <CopyToClipboard text={trackAddress}>
                      <button className="copy-tracked-btn">
                        <Copy size={12} />
                      </button>
                    </CopyToClipboard>
                  </h3>
                  
                  <div className="transaction-filters">
                    <button 
                      className={`filter-btn ${transactionTypeFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setTransactionTypeFilter('all')}
                    >
                      <Globe size={14} /> Semua
                    </button>
                    <button 
                      className={`filter-btn ${transactionTypeFilter === 'incoming' ? 'active' : ''}`}
                      onClick={() => setTransactionTypeFilter('incoming')}
                    >
                      <ArrowDown size={14} /> Masuk
                    </button>
                    <button 
                      className={`filter-btn ${transactionTypeFilter === 'outgoing' ? 'active' : ''}`}
                      onClick={() => setTransactionTypeFilter('outgoing')}
                    >
                      <ArrowUp size={14} /> Keluar
                    </button>
                  </div>
                </div>
                
                {loadingTransactions ? (
                  <div className="loading-transactions">
                    <div className="spinner"></div>
                    <p>Memuat riwayat transaksi...</p>
                  </div>
                ) : displayedTransactions.length > 0 ? (
                  <>
                    <div className="transactions-list">
                      {displayedTransactions.map((tx, index) => {
                        const timeInfo = formatTimestamp(tx.timestamp);
                        const isIncoming = tx.type === 'incoming';
                        
                        return (
                          <div 
                            key={`${tx.hash}-${index}`} 
                            className={`transaction-item ${isIncoming ? 'incoming' : 'outgoing'}`}
                            onClick={() => openTransactionInExplorer(tx.hash)}
                            title="Klik untuk lihat di blockchain explorer"
                          >
                            <div className="transaction-icon">
                              {isIncoming ? (
                                <div className="icon-circle incoming">
                                  <ArrowDown size={16} />
                                </div>
                              ) : (
                                <div className="icon-circle outgoing">
                                  <ArrowUp size={16} />
                                </div>
                              )}
                            </div>
                            
                            <div className="transaction-details">
                              <div className="transaction-addresses">
                                <div className="address-from">
                                  <span className="label">Dari:</span>
                                  <span className="address">{tx.from.substring(0, 8)}...{tx.from.substring(tx.from.length - 6)}</span>
                                </div>
                                <div className="address-to">
                                  <span className="label">Ke:</span>
                                  <span className="address">{tx.to.substring(0, 8)}...{tx.to.substring(tx.to.length - 6)}</span>
                                </div>
                              </div>
                              
                              <div className="transaction-info">
                                <div className="transaction-amount">
                                  <span className="amount">{formatBalance(tx.value, 4)} O2</span>
                                  <span className={`amount-type ${isIncoming ? 'incoming' : 'outgoing'}`}>
                                    {isIncoming ? '+' : '-'}
                                  </span>
                                </div>
                                
                                <div className="transaction-time">
                                  <div className="time-item">
                                    <Calendar size={12} />
                                    <span>{timeInfo.date}</span>
                                  </div>
                                  <div className="time-item">
                                    <Clock size={12} />
                                    <span>{timeInfo.time}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="transaction-actions">
                              <button 
                                className="view-tx-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openTransactionInExplorer(tx.hash);
                                }}
                              >
                                <ExternalLink size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Tombol Show More/Less untuk transaksi */}
                    {hasMoreTransactions && (
                      <div className="show-more-transactions">
                        <button 
                          onClick={toggleShowAllTransactions}
                          className="show-more-transactions-btn"
                          disabled={isLoading}
                        >
                          {showAllTransactions ? (
                            <>
                              <ChevronUp size={16} /> Tampilkan Sedikit (3 Transaksi Terbaru)
                            </>
                          ) : (
                            <>
                              <ChevronDown size={16} /> Tampilkan Semua ({filteredTransactions.length} Transaksi)
                            </>
                          )}
                        </button>
                        <div className="transactions-count">
                          Menampilkan {displayedTransactions.length} dari {filteredTransactions.length} transaksi
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="no-transactions">
                    <p>❌ Tidak ada transaksi ditemukan untuk alamat ini.</p>
                    <p className="hint">Coba alamat wallet lain atau lakukan transfer pertama.</p>
                  </div>
                )}
                
                {displayedTransactions.length > 0 && (
                  <div className="transaction-stats">
                    <div className="stat-item">
                      <div className="stat-icon incoming">
                        <ArrowDown size={16} />
                      </div>
                      <div className="stat-info">
                        <span className="stat-label">Transaksi Masuk</span>
                        <span className="stat-value">
                          {filteredTransactions.filter(tx => tx.type === 'incoming').length}
                        </span>
                      </div>
                    </div>
                    
                    <div className="stat-item">
                      <div className="stat-icon outgoing">
                        <ArrowUp size={16} />
                      </div>
                      <div className="stat-info">
                        <span className="stat-label">Transaksi Keluar</span>
                        <span className="stat-value">
                          {filteredTransactions.filter(tx => tx.type === 'outgoing').length}
                        </span>
                      </div>
                    </div>
                    
                    <div className="stat-item">
                      <div className="stat-icon total">
                        <TrendingUp size={16} />
                      </div>
                      <div className="stat-info">
                        <span className="stat-label">Total Transaksi</span>
                        <span className="stat-value">{filteredTransactions.length}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Transfer Section */}
          <section className="transfer-section">
            <h2>Share Oxygen</h2>
            <div className="transfer-form">
              <input
                type="text"
                placeholder="Recipient Address (0x...)"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="address-input"
                disabled={isLoading}
              />
              <input
                type="number"
                placeholder="Amount of O2 to share"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="amount-input"
                step="0.0001"
                min="0"
                disabled={isLoading}
              />
              <div className="button-group">
                <button 
                  onClick={() => handleTransfer(false)}
                  className="transfer-btn"
                  disabled={!account || isLoading}
                >
                  🌬️ {isLoading ? 'Processing...' : 'Share Oxygen'}
                </button>
                <button 
                  onClick={() => handleTransfer(true)}
                  className="transfer-owner-btn"
                  disabled={!account || isLoading}
                >
                  💎 {isLoading ? 'Processing...' : 'Contribute to Ecosystem'}
                </button>
              </div>
              <p className="tax-notice">
                Note: All transfers include {tokenInfo.taxFee} ecosystem contribution fee
              </p>
            </div>
          </section>

          {/* Holders Section */}
          <section className="holders-section">
            <div className="section-header">
              <h2>Oxygen Holders ({holdersCount})</h2>
              <div className="controls">
                <div className="search-box">
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Filter by address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                    disabled={loadingHolders || isLoading}
                  />
                  {searchTerm && (
                    <button 
                      className="clear-search"
                      onClick={() => setSearchTerm('')}
                      disabled={isLoading}
                    >
                      ×
                    </button>
                  )}
                </div>
                <button 
                  onClick={handleRefreshHolders}
                  className="refresh-btn"
                  disabled={loadingHolders || isLoading}
                >
                  <RefreshCw size={18} className={loadingHolders ? 'spinning' : ''} />
                  {loadingHolders ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>
            
            {loadingHolders ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading oxygen holders...</p>
              </div>
            ) : filteredHolders.length > 0 ? (
              <>
                <div className="table-container">
                  <table className="holders-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Address</th>
                        <th>O2 Balance</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllHolders ? filteredHolders : filteredHolders.slice(0, 10)).map((holder, index) => (
                        <tr key={holder.address}>
                          <td className="rank">
                            <div className="rank-badge">
                              {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                            </div>
                          </td>
                          <td className="address-cell">
                            <span className="full-address" title={holder.address}>
                              {holder.formattedAddress}
                            </span>
                            {holder.address.toLowerCase() === account?.toLowerCase() && (
                              <span className="you-badge">(You)</span>
                            )}
                            {holder.address.toLowerCase() === tokenInfo.owner?.toLowerCase() && (
                              <span className="owner-badge">(Guardian)</span>
                            )}
                          </td>
                          <td className="balance-cell">
                            <span className="oxygen-amount">
                              {holder.balanceFormatted} O2
                            </span>
                          </td>
                          <td className="actions-cell">
                            <CopyToClipboard 
                              text={holder.address} 
                              onCopy={() => handleCopyAddress(holder.address)}
                            >
                              <button className="icon-btn copy" disabled={isLoading}>
                                <Copy size={16} />
                                {copiedAddress === holder.address && (
                                  <span className="tooltip">Copied!</span>
                                )}
                              </button>
                            </CopyToClipboard>
                            <button 
                              className="icon-btn track"
                              onClick={() => {
                                setTrackAddress(holder.address);
                                handleTrackTransactions();
                              }}
                              title="Lacak transaksi alamat ini"
                            >
                              <Search size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {filteredHolders.length > 10 && (
                  <div className="show-more">
                    <button 
                      onClick={() => setShowAllHolders(!showAllHolders)}
                      className="show-more-btn"
                      disabled={isLoading}
                    >
                      {showAllHolders ? 'Show Less' : `Show All ${filteredHolders.length} Holders`}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="no-data">
                <p>No oxygen holders found {searchTerm && `for "${searchTerm}"`}</p>
                {searchTerm && (
                  <button 
                    className="clear-filter-btn"
                    onClick={() => setSearchTerm('')}
                    disabled={isLoading}
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            )}
            
            <div className="holders-note">
              <p>💡 Oxygen holders list updates automatically after every transfer</p>
            </div>
          </section>

          {isOwner && (
            <section className="owner-section">
              <h2>🌿 Guardian Functions</h2>
              <div className="owner-controls">
                <div className="tagline-update">
                  <input
                    type="text"
                    placeholder="Update tagline..."
                    value={newTagline}
                    onChange={(e) => setNewTagline(e.target.value)}
                    className="tagline-input"
                    disabled={isLoading}
                  />
                  <button 
                    onClick={handleUpdateTagline} 
                    className="owner-btn tagline-btn"
                    disabled={isLoading || !newTagline.trim()}
                  >
                    {isLoading ? 'Updating...' : 'Update Tagline'}
                  </button>
                </div>
                <div className="owner-buttons">
                  <button 
                    onClick={handleMint} 
                    className="owner-btn mint-btn"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Processing...' : 'Generate O2'}
                  </button>
                  <button 
                    onClick={handleBurn} 
                    className="owner-btn burn-btn"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Processing...' : 'Purify Supply'}
                  </button>
                </div>
              </div>
            </section>
          )}
        </main>

        <footer className="App-footer">
          <p>🌿 O2 Token • Max Supply: {formatNumber("7000000")} O2 • Decimals: 4</p>
          <p>"Oxygen is Vital. Never Sell. It's Not About Riches, It's About Wealth"</p>
          <p className="footer-note">
            Breathe life into the ecosystem. Real-time updates on oxygen distribution.
          </p>
        </footer>
      </div>
    </>
  );
};

export default App;