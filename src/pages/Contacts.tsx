import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ViewMode = "form" | "view";

interface ContactFormData {
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  department: string;
  kra: string;
  title: string;
  level: string;
  zone: string;
  region: string;
  reportsTo: string;
  positioning: string;
  awignChampion: string;
}

export default function Contacts() {
  const [viewMode, setViewMode] = useState<ViewMode>("view");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [accountContacts, setAccountContacts] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [loadingAccountContacts, setLoadingAccountContacts] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContactData, setEditContactData] = useState<any>(null);
  const [updatingContact, setUpdatingContact] = useState(false);
  const [editAccountContacts, setEditAccountContacts] = useState<{ id: string; first_name: string; last_name: string }[]>([]);

  const [formData, setFormData] = useState<ContactFormData>({
    accountId: "",
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    department: "",
    kra: "",
    title: "",
    level: "",
    zone: "",
    region: "",
    reportsTo: "",
    positioning: "",
    awignChampion: "",
  });

  const { toast } = useToast();

  // Fetch accounts for dropdown
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const { data, error } = await supabase
          .from("accounts")
          .select("id, name")
          .order("name");

        if (error) throw error;
        setAccounts(data || []);
      } catch (error) {
        console.error("Error fetching accounts:", error);
      }
    };

    fetchAccounts();
  }, []);

  // Fetch contacts for selected account
  useEffect(() => {
    const fetchAccountContacts = async () => {
      if (!formData.accountId) {
        setAccountContacts([]);
        // Reset reportsTo when account is cleared
        setFormData((prev) => ({ ...prev, reportsTo: "" }));
        return;
      }

      setLoadingAccountContacts(true);
      try {
        const { data, error } = await supabase
          .from("contacts")
          .select("id, first_name, last_name")
          .eq("account_id", formData.accountId)
          .order("first_name");

        if (error) throw error;
        setAccountContacts(data || []);
        // Reset reportsTo when account changes
        setFormData((prev) => ({ ...prev, reportsTo: "" }));
      } catch (error) {
        console.error("Error fetching account contacts:", error);
        setAccountContacts([]);
      } finally {
        setLoadingAccountContacts(false);
      }
    };

    fetchAccountContacts();
  }, [formData.accountId]);

  const handleInputChange = (field: keyof ContactFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error("You must be logged in to create a contact");
      }

      const contactData = {
        account_id: formData.accountId,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone_number: formData.phoneNumber,
        department: formData.department,
        kra: formData.kra || null,
        title: formData.title,
        level: formData.level,
        zone: formData.zone,
        region: formData.zone === "Regional" ? formData.region : null,
        reports_to: formData.reportsTo || null,
        positioning: formData.positioning,
        awign_champion: formData.awignChampion === "YES",
        created_by: user.id,
      };

      const { error: insertError } = await supabase
        .from("contacts")
        .insert([contactData]);

      if (insertError) throw insertError;

      toast({
        title: "Success!",
        description: "Contact saved successfully.",
      });

      // Reset form
      setFormData({
        accountId: "",
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        department: "",
        kra: "",
        title: "",
        level: "",
        zone: "",
        region: "",
        reportsTo: "",
        positioning: "",
        awignChampion: "",
      });

      // Close dialog and refresh contacts list
      setFormDialogOpen(false);
      fetchContacts();
    } catch (error: any) {
      console.error("Error saving contact:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save contact. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch account names separately
      const accountIds = [...new Set((data || []).map((c: any) => c.account_id).filter(Boolean))];
      const accountMap: Record<string, string> = {};

      if (accountIds.length > 0) {
        const { data: accountData } = await supabase
          .from("accounts")
          .select("id, name")
          .in("id", accountIds);

        if (accountData) {
          accountData.forEach((acc) => {
            accountMap[acc.id] = acc.name;
          });
        }
      }

      // Add account names to contacts
      const contactsWithAccounts = (data || []).map((contact: any) => ({
        ...contact,
        accountName: accountMap[contact.account_id] || "N/A",
      }));

      setContacts(contactsWithAccounts);
    } catch (error: any) {
      console.error("Error fetching contacts:", error);
      toast({
        title: "Error",
        description: "Failed to load contacts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    if (viewMode === "view") {
      fetchContacts();
    }
  }, [viewMode]);

  const handleViewDetails = (contact: any) => {
    setSelectedContact(contact);
    setEditContactData({
      accountId: contact.account_id || "",
      firstName: contact.first_name || "",
      lastName: contact.last_name || "",
      email: contact.email || "",
      phoneNumber: contact.phone_number || "",
      department: contact.department || "",
      kra: contact.kra || "",
      title: contact.title || "",
      level: contact.level || "",
      zone: contact.zone || "",
      region: contact.region || "",
      reportsTo: contact.reports_to || "",
      positioning: contact.positioning || "",
      awignChampion: contact.awign_champion ? "YES" : "NO",
    });
    setIsEditMode(false);
    setDetailsModalOpen(true);
    
    // Fetch contacts for the selected contact's account for Reports To dropdown
    if (contact.account_id) {
      fetchEditAccountContacts(contact.account_id);
    }
  };

  const fetchEditAccountContacts = async (accountId: string) => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .eq("account_id", accountId)
        .order("first_name");

      if (error) throw error;
      setEditAccountContacts(data || []);
    } catch (error) {
      console.error("Error fetching account contacts:", error);
      setEditAccountContacts([]);
    }
  };

  const handleUpdateContact = async () => {
    if (!selectedContact) return;
    
    setUpdatingContact(true);
    try {
      const updateData: any = {
        account_id: editContactData.accountId || null,
        first_name: editContactData.firstName,
        last_name: editContactData.lastName,
        email: editContactData.email,
        phone_number: editContactData.phoneNumber,
        department: editContactData.department || null,
        kra: editContactData.kra || null,
        title: editContactData.title || null,
        level: editContactData.level || null,
        zone: editContactData.zone || null,
        region: editContactData.zone === "Regional" ? editContactData.region : null,
        reports_to: editContactData.reportsTo || null,
        positioning: editContactData.positioning || null,
        awign_champion: editContactData.awignChampion === "YES",
      };

      const { error } = await supabase
        .from("contacts")
        .update(updateData)
        .eq("id", selectedContact.id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Contact updated successfully.",
      });

      setIsEditMode(false);
      setDetailsModalOpen(false);
      fetchContacts();
    } catch (error: any) {
      console.error("Error updating contact:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update contact. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingContact(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">
            Manage your business contacts and relationships.
          </p>
        </div>
        <Button onClick={() => setFormDialogOpen(true)}>
          Add Contact
        </Button>
      </div>

      {/* Add Contact Form Dialog */}
      <Dialog open={formDialogOpen} onOpenChange={(open) => {
        setFormDialogOpen(open);
        if (!open) {
          // Reset form when dialog closes
          setFormData({
            accountId: "",
            firstName: "",
            lastName: "",
            email: "",
            phoneNumber: "",
            department: "",
            kra: "",
            title: "",
            level: "",
            zone: "",
            region: "",
            reportsTo: "",
            positioning: "",
            awignChampion: "",
          });
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1st Segment: General Information */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-blue-900">General Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountId">
                      Account Name <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.accountId}
                      onValueChange={(value) => handleInputChange("accountId", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.length > 0 ? (
                          accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No accounts available
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firstName">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange("firstName", e.target.value)}
                      placeholder="John"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange("lastName", e.target.value)}
                      placeholder="Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="john@domain.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">
                      Phone Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                      placeholder="9876543210"
                      required
                    />
                  </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2nd Segment: Responsibility */}
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-green-900">Responsibility</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">
                      Department <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) => handleInputChange("department", e.target.value)}
                      placeholder="Finance"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kra">KRA (Key Responsibility Area)</Label>
                    <Input
                      id="kra"
                      value={formData.kra}
                      onChange={(e) => handleInputChange("kra", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">
                      Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      placeholder="Head of Procurement"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="level">
                      Level <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.level}
                      onValueChange={(value) => handleInputChange("level", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Lv.3">Lv.3</SelectItem>
                        <SelectItem value="Lv.2">Lv.2</SelectItem>
                        <SelectItem value="Lv.1">Lv.1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  </div>
                </CardContent>
              </Card>

              {/* 3rd Segment: Mapping */}
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-purple-900">Mapping</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="zone">
                      Zone <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.zone}
                      onValueChange={(value) => handleInputChange("zone", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select zone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Central">Central</SelectItem>
                        <SelectItem value="Regional">Regional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.zone === "Regional" && (
                    <div className="space-y-2">
                      <Label htmlFor="region">Region</Label>
                      <Input
                        id="region"
                        value={formData.region}
                        onChange={(e) => handleInputChange("region", e.target.value)}
                        placeholder="North 2"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="reportsTo">Reports To</Label>
                    <Select
                      value={formData.reportsTo || "N/A"}
                      onValueChange={(value) => handleInputChange("reportsTo", value === "N/A" ? "" : value)}
                      disabled={!formData.accountId || loadingAccountContacts}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={!formData.accountId ? "Select account first" : "Select contact or N/A"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="N/A">N/A</SelectItem>
                        {accountContacts.length > 0 ? (
                          accountContacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              {contact.first_name} {contact.last_name}
                            </SelectItem>
                          ))
                        ) : formData.accountId ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No contacts found for this account
                          </div>
                        ) : null}
                      </SelectContent>
                    </Select>
                  </div>
                  </div>
                </CardContent>
              </Card>

              {/* 4th Segment: Supplement */}
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-orange-900">Supplement</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="positioning">
                      Positioning <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.positioning}
                      onValueChange={(value) => handleInputChange("positioning", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select positioning" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Decision Maker">Decision Maker</SelectItem>
                        <SelectItem value="Influencer">Influencer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="awignChampion">
                      Awign Champion <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.awignChampion}
                      onValueChange={(value) => handleInputChange("awignChampion", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YES">YES</SelectItem>
                        <SelectItem value="NO">NO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      accountId: "",
                      firstName: "",
                      lastName: "",
                      email: "",
                      phoneNumber: "",
                      department: "",
                      kra: "",
                      title: "",
                      level: "",
                      zone: "",
                      region: "",
                      reportsTo: "",
                      positioning: "",
                      awignChampion: "",
                    });
                  }}
                >
                  Clear
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Contact"
                  )}
                </Button>
              </div>
            </form>
        </DialogContent>
      </Dialog>

      {/* View Contacts Table */}
      {viewMode === "view" && (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingContacts ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-muted-foreground">Loading contacts...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : contacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No contacts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>{contact.accountName || "N/A"}</TableCell>
                        <TableCell className="font-medium">
                          {contact.first_name} {contact.last_name}
                        </TableCell>
                        <TableCell>{contact.email}</TableCell>
                        <TableCell>{contact.phone_number}</TableCell>
                        <TableCell>{contact.title}</TableCell>
                        <TableCell>{contact.level}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(contact)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={(open) => {
        setDetailsModalOpen(open);
        if (!open) {
          setIsEditMode(false);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                {selectedContact
                  ? `${selectedContact.first_name} ${selectedContact.last_name}`
                  : "Contact Details"}
              </DialogTitle>
              <div className="flex gap-2">
                {!isEditMode ? (
                  <Button variant="outline" onClick={() => setIsEditMode(true)}>
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => {
                      setIsEditMode(false);
                      setEditContactData({
                        accountId: selectedContact.account_id || "",
                        firstName: selectedContact.first_name || "",
                        lastName: selectedContact.last_name || "",
                        email: selectedContact.email || "",
                        phoneNumber: selectedContact.phone_number || "",
                        department: selectedContact.department || "",
                        kra: selectedContact.kra || "",
                        title: selectedContact.title || "",
                        level: selectedContact.level || "",
                        zone: selectedContact.zone || "",
                        region: selectedContact.region || "",
                        reportsTo: selectedContact.reports_to || "",
                        positioning: selectedContact.positioning || "",
                        awignChampion: selectedContact.awign_champion ? "YES" : "NO",
                      });
                    }}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdateContact} disabled={updatingContact}>
                      {updatingContact ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>
          {selectedContact && editContactData && (
            <div className="space-y-6">
              {/* 1st Segment: General Information */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-blue-900">General Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Account Name:</Label>
                      {isEditMode ? (
                        <Select
                          value={editContactData.accountId}
                          onValueChange={(value) => {
                            setEditContactData({ ...editContactData, accountId: value, reportsTo: "" });
                            fetchEditAccountContacts(value);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedContact.accountName || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">First Name:</Label>
                      {isEditMode ? (
                        <Input
                          value={editContactData.firstName}
                          onChange={(e) => setEditContactData({ ...editContactData, firstName: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedContact.first_name || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Last Name:</Label>
                      {isEditMode ? (
                        <Input
                          value={editContactData.lastName}
                          onChange={(e) => setEditContactData({ ...editContactData, lastName: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedContact.last_name || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Email:</Label>
                      {isEditMode ? (
                        <Input
                          type="email"
                          value={editContactData.email}
                          onChange={(e) => setEditContactData({ ...editContactData, email: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedContact.email || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Phone Number:</Label>
                      {isEditMode ? (
                        <Input
                          value={editContactData.phoneNumber}
                          onChange={(e) => setEditContactData({ ...editContactData, phoneNumber: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedContact.phone_number || "N/A"}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2nd Segment: Responsibility */}
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-green-900">Responsibility</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Department:</Label>
                      {isEditMode ? (
                        <Input
                          value={editContactData.department}
                          onChange={(e) => setEditContactData({ ...editContactData, department: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedContact.department || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">KRA (Key Responsibility Area):</Label>
                      {isEditMode ? (
                        <Input
                          value={editContactData.kra}
                          onChange={(e) => setEditContactData({ ...editContactData, kra: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedContact.kra || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Title:</Label>
                      {isEditMode ? (
                        <Input
                          value={editContactData.title}
                          onChange={(e) => setEditContactData({ ...editContactData, title: e.target.value })}
                        />
                      ) : (
                        <p className="mt-1">{selectedContact.title || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Level:</Label>
                      {isEditMode ? (
                        <Select
                          value={editContactData.level}
                          onValueChange={(value) => setEditContactData({ ...editContactData, level: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Lv.3">Lv.3</SelectItem>
                            <SelectItem value="Lv.2">Lv.2</SelectItem>
                            <SelectItem value="Lv.1">Lv.1</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedContact.level || "N/A"}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 3rd Segment: Mapping */}
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-purple-900">Mapping</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Zone:</Label>
                      {isEditMode ? (
                        <Select
                          value={editContactData.zone}
                          onValueChange={(value) => setEditContactData({ ...editContactData, zone: value, region: value === "Regional" ? editContactData.region : "" })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select zone" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Central">Central</SelectItem>
                            <SelectItem value="Regional">Regional</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedContact.zone || "N/A"}</p>
                      )}
                    </div>
                    {((isEditMode && editContactData.zone === "Regional") || (!isEditMode && selectedContact.zone === "Regional")) && (
                      <div className="space-y-2">
                        <Label className="font-medium text-muted-foreground">Region:</Label>
                        {isEditMode ? (
                          <Input
                            value={editContactData.region}
                            onChange={(e) => setEditContactData({ ...editContactData, region: e.target.value })}
                            placeholder="North 2"
                          />
                        ) : (
                          <p className="mt-1">{selectedContact.region || "N/A"}</p>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Reports To:</Label>
                      {isEditMode ? (
                        <Select
                          value={editContactData.reportsTo || "N/A"}
                          onValueChange={(value) => setEditContactData({ ...editContactData, reportsTo: value === "N/A" ? "" : value })}
                          disabled={!editContactData.accountId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={!editContactData.accountId ? "Select account first" : "Select contact or N/A"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="N/A">N/A</SelectItem>
                            {editAccountContacts.length > 0 ? (
                              editAccountContacts
                                .filter((contact) => contact.id !== selectedContact.id) // Exclude current contact
                                .map((contact) => (
                                  <SelectItem key={contact.id} value={contact.id}>
                                    {contact.first_name} {contact.last_name}
                                  </SelectItem>
                                ))
                            ) : editContactData.accountId ? (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                No other contacts found for this account
                              </div>
                            ) : null}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">
                          {selectedContact.reports_to 
                            ? editAccountContacts.find(c => c.id === selectedContact.reports_to) 
                              ? `${editAccountContacts.find(c => c.id === selectedContact.reports_to)?.first_name} ${editAccountContacts.find(c => c.id === selectedContact.reports_to)?.last_name}`
                              : "N/A"
                            : "N/A"}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 4th Segment: Supplement */}
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4 text-orange-900">Supplement</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Positioning:</Label>
                      {isEditMode ? (
                        <Select
                          value={editContactData.positioning}
                          onValueChange={(value) => setEditContactData({ ...editContactData, positioning: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select positioning" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Decision Maker">Decision Maker</SelectItem>
                            <SelectItem value="Influencer">Influencer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedContact.positioning || "N/A"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-muted-foreground">Awign Champion:</Label>
                      {isEditMode ? (
                        <Select
                          value={editContactData.awignChampion}
                          onValueChange={(value) => setEditContactData({ ...editContactData, awignChampion: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="YES">YES</SelectItem>
                            <SelectItem value="NO">NO</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1">{selectedContact.awign_champion ? "YES" : "NO"}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
