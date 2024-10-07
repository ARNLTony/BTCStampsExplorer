// islands/stamp/details/StampBuyModal.tsx
import { useEffect, useState } from "preact/hooks";
import { StampRow } from "globals";
import { useFeePolling } from "hooks/useFeePolling.tsx";
import StampImage from "./StampImage.tsx";
import {
  showConnectWalletModal,
  walletContext,
} from "$lib/store/wallet/wallet.ts";

interface Props {
  stamp: StampRow;
  fee: number;
  handleChangeFee: (fee: number) => void;
  toggleModal: () => void;
  handleCloseModal: () => void;
  dispenser: any;
}

const StampBuyModal = (
  { stamp, fee, handleChangeFee, toggleModal, handleCloseModal, dispenser }:
    Props,
) => {
  const { wallet } = walletContext;
  const connected = walletContext.isConnected.value;
  const { fees, loading } = useFeePolling();

  const [quantity, setQuantity] = useState(1);
  const [maxQuantity, setMaxQuantity] = useState(1);
  const [pricePerUnit, setPricePerUnit] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (dispenser) {
      const maxQty = Math.floor(
        dispenser.give_remaining / dispenser.give_quantity,
      );
      setMaxQuantity(maxQty);
      setPricePerUnit(dispenser.satoshirate);
      setTotalPrice(quantity * dispenser.satoshirate);
    }
  }, [dispenser]);

  const handleQuantityChange = (e: Event) => {
    const value = parseInt((e.target as HTMLInputElement).value, 10);
    if (value > maxQuantity) {
      setQuantity(maxQuantity);
    } else if (value < 1 || isNaN(value)) {
      setQuantity(1);
    } else {
      setQuantity(value);
    }
  };

  useEffect(() => {
    setTotalPrice(quantity * pricePerUnit);
  }, [quantity, pricePerUnit]);

  const handleBuyClick = async () => {
    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      if (!connected || !wallet.value) {
        setError("Please connect your wallet.");
        showConnectWalletModal.value = true; // Show wallet connect modal
        setIsSubmitting(false);
        return;
      }

      if (!isLocked) {
        setError("You must agree to the terms and conditions.");
        setIsSubmitting(false);
        return;
      }

      const options = {
        return_psbt: true,
        fee_per_kb: fee,
      };

      // Prepare the request body
      const requestBody = {
        address: wallet.value.address,
        dispenser: dispenser.source,
        quantity: totalPrice, // Total BTC amount in satoshis
        options,
      };

      // Call the server-side API to create the dispense transaction
      const response = await fetch("/api/v2/create/dispense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to create dispense transaction.");
        setIsSubmitting(false);
        return;
      }

      const responseData = await response.json();

      if (!responseData || !responseData.result || !responseData.result.psbt) {
        setError("Failed to create dispense transaction.");
        setIsSubmitting(false);
        return;
      }

      const psbtHex = responseData.result.psbt;
      // TODO: this is not active yet until CP block activation, but may not want to use psbt here if CP doesn't return
      // the inputs to sign. otherwie we need to deconstruct, etc
      // Sign PSBT using walletContext
      const inputsToSign = []; // Adjust as needed based on your PSBT
      const signResult = await walletContext.signPSBT(
        wallet.value,
        psbtHex,
        inputsToSign,
        true, // Enable RBF
      );

      if (signResult.signed) {
        // Broadcast the signed PSBT
        const txid = await walletContext.broadcastPSBT(signResult.psbt);

        // Handle success, show confirmation to user
        console.log("Transaction broadcasted successfully. TXID:", txid);
        setSuccessMessage(
          `Transaction broadcasted successfully. TXID: ${txid}`,
        );
        // Optionally close the modal and reset states after a delay
        setTimeout(() => {
          setIsSubmitting(false);
          setSuccessMessage("");
          toggleModal();
          // Reset any other states as needed
        }, 5000);
      } else if (signResult.cancelled) {
        setError("Transaction signing was cancelled.");
      } else {
        setError("Failed to sign PSBT: " + signResult.error);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create or send transaction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-[#181818] bg-opacity-50 backdrop-filter backdrop-blur-sm"
      onClick={handleCloseModal}
    >
      <div class="relative p-4 w-full max-w-[360px] h-auto">
        <div
          class="relative bg-white rounded-lg shadow dark:bg-[#0B0B0B] overflow-hidden"
          onClick={(e) => e.stopPropagation()} // Prevent click from closing the modal
        >
          <div class="flex flex-col gap-4 items-center justify-between p-4 md:p-5 rounded-t">
            <button
              onClick={toggleModal}
              type="button"
              class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
              data-modal-hide="default-modal"
            >
              <svg
                class="w-3 h-3"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 14 14"
              >
                <path
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                />
              </svg>
              <span class="sr-only">Close modal</span>
            </button>
            <StampImage stamp={stamp} className="w-[200px] !p-2" flag={false} />
            <p
              className={"bg-clip-text text-transparent bg-gradient-to-r from-[#AA00FF] via-[#660099] to-[#440066] text-2xl font-black text-center"}
            >
              BUY STAMP #{stamp.stamp}
            </p>
            <div className={"flex justify-between items-center w-full"}>
              <p className={"text-[#999999] flex flex-col"}>
                QUANTITY
                <span className={"text-[#666666]"}>max {maxQuantity}</span>
              </p>
              <input
                type="number"
                min="1"
                max={maxQuantity}
                value={quantity}
                onChange={handleQuantityChange}
                className={"bg-[#999999] text-[#666666] font-bold text-xl rounded-md p-3"}
              />
            </div>
            <div className={"flex flex-col w-full"}>
              <span class="flex justify-between w-full text-[#F5F5F5]">
                FEE: {fee} sat/vB
              </span>
              <div class="relative w-full">
                <label htmlFor="labels-range-input" class="sr-only">
                  Labels range
                </label>
                <input
                  id="labels-range-input"
                  type="range"
                  value={fee}
                  min="1"
                  max="264"
                  step="1"
                  onInput={(e) =>
                    handleChangeFee(
                      parseInt((e.target as HTMLInputElement).value, 10),
                    )}
                  class="accent-[#5E1BA1] w-full h-[6px] rounded-lg appearance-none cursor-pointer bg-[#3F2A4E]"
                />
              </div>
              <span class="justify-end flex w-full text-[#F5F5F5] text-sm">
                RECOMMENDED: {fees && fees.recommendedFee} sat/vB
              </span>
            </div>

            <div className={"flex flex-col items-end w-full text-[#999999]"}>
              <p
                className={"font-medium text-base flex justify-between w-full"}
              >
                ESTIMATE
                <span className={"font-bold"}>
                  {(totalPrice / 1e8).toFixed(8)} BTC
                </span>
              </p>
              {/* Optionally display USD value if available */}
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="checkbox"
                id="lockEditions"
                name="lockEditions"
                checked={isLocked}
                onChange={(e) => setIsLocked(e.target.checked)}
                className="w-5 h-5 bg-[#262424] border border-[#7F7979]"
              />
              <label
                htmlFor="lockEditions"
                className="text-[#999999] text-[12px] font-medium"
              >
                I agree to the{" "}
                <span className={"text-[#8800CC]"}>terms and conditions</span>
              </label>
            </div>
            <div className={"flex gap-6"}>
              <button
                className={"border-2 border-[#8800CC] text-[#8800CC] min-w-[114px] h-[48px] rounded-md font-extrabold"}
                onClick={toggleModal}
                disabled={isSubmitting}
              >
                CANCEL
              </button>
              <button
                className={"bg-[#8800CC] text-[#330033] min-w-[114px] h-[48px] rounded-md font-extrabold"}
                onClick={handleBuyClick}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Processing..." : "BUY"}
              </button>
            </div>
            {/* Error message */}
            {error && <div className="text-red-500 mt-2">{error}</div>}
            {/* Success message */}
            {successMessage && (
              <div className="text-green-500 mt-2">{successMessage}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StampBuyModal;
