import StoreSubscription from "../models/storeSubscriptionModel.js";
import Store from "../models/storeModel.js";

// Setup or update a store's subscription
export const setupSubscription = async (req, res) => {
  try {
    const { storeId, planType, totalAmount, downpayment, timelineMonths, schedules } = req.body;

    if (!storeId || !planType || !totalAmount || !schedules) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    let subscription = await StoreSubscription.findOne({ storeId });

    if (subscription) {
      subscription.planType = planType;
      subscription.totalAmount = totalAmount;
      subscription.downpayment = downpayment;
      subscription.timelineMonths = timelineMonths;
      subscription.schedules = schedules;
      await subscription.save();
    } else {
      subscription = new StoreSubscription({
        storeId,
        planType,
        totalAmount,
        downpayment,
        timelineMonths,
        schedules
      });
      await subscription.save();
    }

    res.status(200).json({ message: "Subscription setup successfully", subscription });
  } catch (error) {
    console.error("Setup subscription error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all stores with pending UTR approvals (status = 'uploaded')
export const getPendingApprovals = async (req, res) => {
  try {
    const subscriptions = await StoreSubscription.find({
      "schedules.status": "uploaded"
    }).populate("storeId", "storeName contactNumber");

    // Filter schedules to only send the uploaded ones for approval
    const pendingList = [];
    subscriptions.forEach(sub => {
      sub.schedules.forEach(schedule => {
        if (schedule.status === "uploaded") {
          pendingList.push({
            subscriptionId: sub._id,
            storeId: sub.storeId._id,
            storeName: sub.storeId.storeName,
            contactNumber: sub.storeId.contactNumber,
            scheduleId: schedule._id,
            amount: schedule.amount,
            dueDate: schedule.dueDate,
            utrNumber: schedule.utrNumber
          });
        }
      });
    });

    res.status(200).json({ pendingApprovals: pendingList });
  } catch (error) {
    console.error("Get pending approvals error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Approve a specific payment schedule
export const approvePayment = async (req, res) => {
  try {
    const { subscriptionId, scheduleId } = req.body;

    if (!subscriptionId || !scheduleId) {
      return res.status(400).json({ message: "Missing subscriptionId or scheduleId" });
    }

    const subscription = await StoreSubscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    const schedule = subscription.schedules.id(scheduleId);
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    schedule.status = "paid";
    schedule.paidDate = new Date();

    await subscription.save();

    res.status(200).json({ message: "Payment approved successfully" });
  } catch (error) {
    console.error("Approve payment error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all subscriptions for admin view
export const getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await StoreSubscription.find().populate("storeId", "storeName contactNumber");
    res.status(200).json({ subscriptions });
  } catch (error) {
    console.error("Get all subscriptions error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all stores for the setup dropdown
export const getAllStores = async (req, res) => {
  try {
    const stores = await Store.find({}, "storeName contactNumber");
    res.status(200).json({ stores });
  } catch (error) {
    console.error("Get all stores error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Mark entire subscription as fully paid
export const markAllPaid = async (req, res) => {
  try {
    const { storeId } = req.params;
    const subscription = await StoreSubscription.findOne({ storeId });
    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    subscription.schedules.forEach(schedule => {
      if (schedule.status !== "paid") {
        schedule.status = "paid";
        schedule.paidDate = new Date();
      }
    });

    await subscription.save();
    res.status(200).json({ message: "Store marked as fully paid successfully" });
  } catch (error) {
    console.error("Mark all paid error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a subscription completely
export const deleteSubscription = async (req, res) => {
  try {
    const { storeId } = req.params;
    const subscription = await StoreSubscription.findOneAndDelete({ storeId });
    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }
    res.status(200).json({ message: "Subscription deleted successfully" });
  } catch (error) {
    console.error("Delete subscription error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
