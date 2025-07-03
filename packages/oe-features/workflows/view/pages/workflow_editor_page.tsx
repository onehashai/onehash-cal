import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

import ActionModule from "./ActionModule";

interface ActionModuleData {
  id: string;
  sendVia: string;
  message: string;
  template: string;
}

const WorkflowEditor = () => {
  const [workflowName, setWorkflowName] = useState("Booking Confirmation Workflow");
  const [eventType, setEventType] = useState("");
  const [applyToFuture, setApplyToFuture] = useState(false);
  const [triggerTime, setTriggerTime] = useState("");
  const [actions, setActions] = useState<ActionModuleData[]>([
    { id: "1", sendVia: "", message: "", template: "" },
  ]);

  const addAction = () => {
    const newAction: ActionModuleData = {
      id: Date.now().toString(),
      sendVia: "",
      message: "",
      template: "",
    };
    setActions([...actions, newAction]);
  };

  const removeAction = (id: string) => {
    setActions(actions.filter((action) => action.id !== id));
  };

  const updateAction = (id: string, field: keyof ActionModuleData, value: string) => {
    setActions(actions.map((action) => (action.id === id ? { ...action, [field]: value } : action)));
  };

  return (
    <div className="mx-auto max-w-4xl bg-white p-8">
      {/* Top Controls */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-medium text-gray-900">Edit Workflow</h1>
        <div className="flex gap-3">
          <Button variant="outline" className="border-gray-300 text-gray-600 hover:bg-gray-50">
            Delete Workflow
          </Button>
          <Button className="bg-black text-white hover:bg-gray-800">Save Workflow</Button>
        </div>
      </div>

      {/* Workflow Name Section */}
      <div className="mb-8">
        <Label htmlFor="workflow-name" className="mb-2 block text-sm font-medium text-gray-700">
          Workflow Name
        </Label>
        <Input
          id="workflow-name"
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          className="w-full border-gray-200 focus:border-gray-400 focus:ring-0"
          placeholder="Enter workflow name"
        />
      </div>

      {/* Event Selection Section */}
      <div className="mb-8">
        <Label className="mb-2 block text-sm font-medium text-gray-700">Apply this workflow to</Label>
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="w-full border-gray-200 focus:border-gray-400 focus:ring-0">
            <SelectValue placeholder="Choose an event type" />
          </SelectTrigger>
          <SelectContent className="border-gray-200 bg-white">
            <SelectItem value="booking-confirmed">Booking Confirmed</SelectItem>
            <SelectItem value="booking-cancelled">Booking Cancelled</SelectItem>
            <SelectItem value="booking-rescheduled">Booking Rescheduled</SelectItem>
            <SelectItem value="payment-received">Payment Received</SelectItem>
          </SelectContent>
        </Select>

        <div className="mt-3 flex items-center space-x-2">
          <Checkbox
            id="apply-future"
            checked={applyToFuture}
            onCheckedChange={(checked) => setApplyToFuture(checked as boolean)}
          />
          <Label htmlFor="apply-future" className="text-sm text-gray-600">
            Apply to all future events
          </Label>
        </div>
      </div>

      {/* Trigger Module Section */}
      <div className="mb-8">
        <Label className="mb-2 block text-sm font-medium text-gray-700">
          When should this workflow be triggered?
        </Label>
        <Select value={triggerTime} onValueChange={setTriggerTime}>
          <SelectTrigger className="w-full border-gray-200 focus:border-gray-400 focus:ring-0">
            <SelectValue placeholder="Select trigger timing" />
          </SelectTrigger>
          <SelectContent className="border-gray-200 bg-white">
            <SelectItem value="immediately">Immediately</SelectItem>
            <SelectItem value="1-hour-before">1 hour before</SelectItem>
            <SelectItem value="1-day-before">1 day before</SelectItem>
            <SelectItem value="1-hour-after">1 hour after</SelectItem>
            <SelectItem value="1-day-after">1 day after</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Action Modules Section */}
      <div className="mb-6">
        <Label className="mb-4 block text-sm font-medium text-gray-700">Action Modules</Label>

        {actions.map((action, index) => (
          <ActionModule
            key={action.id}
            action={action}
            index={index}
            onUpdate={updateAction}
            onRemove={removeAction}
            showRemove={actions.length > 1}
          />
        ))}

        <Button
          variant="outline"
          onClick={addAction}
          className="mt-4 border-gray-300 text-gray-600 hover:bg-gray-50">
          + Add Another Action
        </Button>
      </div>
    </div>
  );
};

export default WorkflowEditor;
