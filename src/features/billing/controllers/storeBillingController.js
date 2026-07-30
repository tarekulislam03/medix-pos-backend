import StoreSubscription from "../models/storeSubscriptionModel.js";
import Store from "../../store/models/storeModel.js";

// Get billing status for the logged-in store
export const getBillingStatus = async (req, res) => {
  try {
    const storeId = req.storeId;
    
    // Check if store is on an expired trial
    const store = await Store.findById(storeId).lean();
    if (store) {
      if (store.isBlocked) {
        return res.status(200).json({
          status: "blocked",
          schedule: {
            _id: "manual-blocked",
            isManualBlock: true,
            dueDate: new Date(),
            amount: 0,
            paymentStatus: "pending",
            isCustom: false,
            upiId: "",
            blockDays: 0
          }
        });
      }

      if (store.isTrial && store.trialEndDate) {
        const now = new Date();
        const cutoffDate = store.mercyEndDate ? new Date(store.mercyEndDate) : new Date(store.trialEndDate);
        
        // Ensure the cutoff happens at the very end of the specified date
        cutoffDate.setHours(23, 59, 59, 999);
        
        if (now > cutoffDate) {
          return res.status(200).json({
            status: "blocked",
            schedule: {
              _id: "trial-expired",
              isTrialExpiration: true,
              dueDate: store.trialEndDate,
              amount: 0,
              paymentStatus: "pending",
              isCustom: false,
              upiId: "",
              blockDays: 0
            }
          });
        }
      }
    }

    const subscription = await StoreSubscription.findOne({ storeId });

    if (!subscription) {
      return res.status(200).json({ status: "active", message: "No subscription found" });
    }

    const now = new Date();
    
    // Find the earliest schedule that is NOT paid
    const pendingSchedules = subscription.schedules
      .filter(s => s.status !== "paid")
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    if (pendingSchedules.length === 0) {
      return res.status(200).json({ status: "active", message: "All clear" });
    }

    const currentSchedule = pendingSchedules[0];
    const dueDate = new Date(currentSchedule.dueDate);

    // Calculate days difference
    const diffTime = now - dueDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // positive if overdue, negative if upcoming

    let appStatus = "active";

    // Prioritize schedule-level properties if custom, else fall back to subscription
    const blockDays = currentSchedule.isCustom ? 99999 : (subscription.blockDays !== undefined ? subscription.blockDays : 10);
    const warningDays = currentSchedule.isCustom ? 99999 : (subscription.warningDays !== undefined ? subscription.warningDays : 5);
    const scheduleUpiId = currentSchedule.isCustom ? "" : (subscription.upiId || "");

    if (diffDays > blockDays) {
      appStatus = "blocked";
    } else if (diffDays >= -warningDays) {
      appStatus = "warning";
    }

    res.status(200).json({
      status: appStatus,
      schedule: {
        _id: currentSchedule._id,
        amount: currentSchedule.amount,
        dueDate: currentSchedule.dueDate,
        paymentStatus: currentSchedule.status, // pending, uploaded
        isCustom: currentSchedule.isCustom || false,
        upiId: scheduleUpiId,
        blockDays: blockDays
      }
    });

  } catch (error) {
    console.error("Get billing status error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Store submits UTR
export const submitUtr = async (req, res) => {
  try {
    const storeId = req.storeId;
    const { scheduleId, utrNumber } = req.body;

    if (!scheduleId || !utrNumber) {
      return res.status(400).json({ message: "Missing scheduleId or utrNumber" });
    }

    const subscription = await StoreSubscription.findOne({ storeId });
    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    const schedule = subscription.schedules.id(scheduleId);
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    if (schedule.status === "paid") {
      return res.status(400).json({ message: "Already paid" });
    }

    schedule.status = "uploaded";
    schedule.utrNumber = utrNumber;

    await subscription.save();

    res.status(200).json({ message: "UTR submitted successfully", schedule });

  } catch (error) {
    console.error("Submit UTR error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get full subscription details for the store
export const getStoreSubscriptionDetails = async (req, res) => {
  try {
    const storeId = req.storeId;
    const subscription = await StoreSubscription.findOne({ storeId });
    if (!subscription) {
      return res.status(200).json({ subscription: null });
    }
    res.status(200).json({ subscription });
  } catch (error) {
    console.error("Get subscription error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
