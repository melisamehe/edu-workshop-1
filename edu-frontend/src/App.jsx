import { useState, useEffect } from "react";
import Web3 from "web3";
import CourseSubABI from "./CourseSubABI.json";

const CONTRACT_ADDRESS = "0x849667a57C2cC74D3cC38d58188071B2e0B4Da78";

const CourseSubscription = () => {
  const [web3, setWeb3] = useState(null);
  const [account, setAccount] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [remainingHours, setRemainingHours] = useState(0);
  const [coursePrice, setCoursePrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contract, setContract] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [contractBalance, setContractBalance] = useState("0");

  // Parse error messages
  const parseErrorMessage = (error) => {
    if (error.data?.message) {
      return error.data.message.replace("execution reverted:", "").trim();
    }
    return error.message || "Transaction failed";
  };

  // Initialize Web3 and restore wallet if previously connected
  useEffect(() => {
    const initWeb3 = async () => {
      if (window.ethereum) {
        try {
          const web3Instance = new Web3(window.ethereum);
          setWeb3(web3Instance);

          const contractInstance = new web3Instance.eth.Contract(
            CourseSubABI,
            CONTRACT_ADDRESS
          );
          setContract(contractInstance);

          // Check if there is a stored account in localStorage
          const storedAccount = localStorage.getItem("connectedAccount");
          if (storedAccount) {
            setAccount(storedAccount);
            const owner = await contractInstance.methods.owner().call();
            setIsOwner(storedAccount.toLowerCase() === owner.toLowerCase());
            await checkAccess(storedAccount, web3Instance, contractInstance);
          }
        } catch (err) {
          console.error("Initialization error:", err);
          setError("Failed to initialize: Please check your wallet connection");
        }
      }
    };

    initWeb3();
  }, []);

  // Connect wallet
  const connectWallet = async () => {
    setError("");
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const selectedAccount = accounts[0];
      setAccount(selectedAccount);
      localStorage.setItem("connectedAccount", selectedAccount);

      if (contract) {
        const owner = await contract.methods.owner().call();
        const isOwnerAccount =
          selectedAccount.toLowerCase() === owner.toLowerCase();
        setIsOwner(isOwnerAccount);
        await checkAccess(selectedAccount, web3, contract);
      }
    } catch (err) {
      console.error("Connection error:", err);
      setError("Failed to connect wallet. Please try again.");
    }
  };

  // Check access
  const checkAccess = async (
    userAddress,
    web3Instance = web3,
    contractInstance = contract
  ) => {
    if (!contractInstance || !userAddress) return;

    setLoading(true);
    try {
      const [access, hours, price] = await Promise.all([
        contractInstance.methods.hasAccess(userAddress).call(),
        contractInstance.methods.getRemainingHours(userAddress).call(),
        contractInstance.methods.coursePrice().call(),
      ]);

      setHasAccess(access);
      setRemainingHours(Number(hours));
      setCoursePrice(web3Instance.utils.fromWei(price, "ether"));

      if (isOwner) {
        try {
          const balance = await contractInstance.methods
            .getContractBalance()
            .call({ from: userAddress });
          setContractBalance(web3Instance.utils.fromWei(balance, "ether"));
        } catch (err) {
          console.log("Balance check failed - user might not be owner");
          console.error(err);
        }
      }
    } catch (err) {
      console.error("Access check error:", err);
      setError(parseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Purchase access
  const purchaseAccess = async () => {
    setLoading(true);
    setError("");
    try {
      const tx = await contract.methods.buyAccess().send({
        from: account,
        value: web3.utils.toWei(coursePrice, "ether"),
      });
      console.log("Purchase successful:", tx);
      await checkAccess(account);
    } catch (err) {
      console.error("Purchase error:", err);
      setError(parseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Owner: withdraw all
  const withdrawAll = async () => {
    setLoading(true);
    setError("");
    try {
      if (!isOwner) {
        throw new Error("Only owner can withdraw funds");
      }
      const tx = await contract.methods.withdrawAll().send({ from: account });
      console.log("Withdrawal successful:", tx);
      await checkAccess(account);
    } catch (err) {
      console.error("Withdrawal error:", err);
      setError(parseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Consume access
  const consumeAllAccess = async () => {
    setLoading(true);
    setError("");
    try {
      const tx = await contract.methods
        .consumeAllAccess()
        .send({ from: account });
      console.log("Access consumed:", tx);
      await checkAccess(account);
    } catch (err) {
      console.error("Consume access error:", err);
      setError(parseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", async (accounts) => {
        if (accounts.length > 0) {
          const newAccount = accounts[0];
          setAccount(newAccount);
          localStorage.setItem("connectedAccount", newAccount);
          if (contract) {
            const owner = await contract.methods.owner().call();
            setIsOwner(newAccount.toLowerCase() === owner.toLowerCase());
            await checkAccess(newAccount);
          }
        } else {
          setAccount("");
          setIsOwner(false);
          setHasAccess(false);
          setRemainingHours(0);
          localStorage.removeItem("connectedAccount");
        }
      });

      return () => {
        window.ethereum.removeListener("accountsChanged", () => {});
      };
    }
  }, [contract]);

  // Periodically refresh access status
  useEffect(() => {
    if (account) {
      const interval = setInterval(() => {
        checkAccess(account);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [account]);

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Loading state */}
        {loading && (
          <div className="bg-yellow-100 p-4 rounded-lg text-center text-yellow-700 mb-4">
            Loading... Please wait
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-8">
            <div className="text-2xl font-bold mb-2">Course Subscription</div>
            <p className="text-gray-500 mb-6">
              Purchase access to exclusive course content
            </p>

            <div className="space-y-6">
              {!account ? (
                <button
                  onClick={connectWallet}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Connect Wallet
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                      Connected Account:
                    </span>
                    <span className="text-sm text-gray-500">
                      {account.slice(0, 6)}...{account.slice(-4)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Role:</span>
                    <span className="text-sm text-blue-500">
                      {isOwner ? "Owner" : "User"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                      Subscription Status:
                    </span>
                    <span
                      className={`text-sm ${
                        hasAccess ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {hasAccess ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {hasAccess && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        Time Remaining:
                      </span>
                      <span className="text-sm">{remainingHours} hours</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Course Price:</span>
                    <span className="text-sm">{coursePrice} EDU</span>
                  </div>
                </div>
              )}

              {account && !hasAccess && (
                <button
                  onClick={purchaseAccess}
                  disabled={loading}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400"
                >
                  {loading
                    ? "Processing..."
                    : `Purchase Access (${coursePrice} EDU)`}
                </button>
              )}

              {account && hasAccess && (
                <button
                  onClick={consumeAllAccess}
                  disabled={loading}
                  className="w-full bg-yellow-500 text-white py-2 px-4 rounded-lg hover:bg-yellow-600 transition-colors disabled:bg-gray-400"
                >
                  {loading ? "Processing..." : "Consume All Access"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Admin Panel */}
        {isOwner && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-8">
              <div className="text-xl font-bold mb-4">Admin Panel</div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Contract Balance:</span>
                  <span className="text-sm">{contractBalance} EDU</span>
                </div>

                <button
                  onClick={withdrawAll}
                  disabled={loading}
                  className="w-full bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-400"
                >
                  {loading ? "Processing..." : "Withdraw All Funds"}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded-lg">{error}</div>
        )}
      </div>
    </div>
  );
};

export default CourseSubscription;
