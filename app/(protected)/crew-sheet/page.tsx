"use client"

import { useEffect, useMemo, useState } from "react"
import Header from "@/components/header"
import { ProjectSelector } from "@/components/project-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Users, Plus, Edit, Save, X, Trash2, Phone, Mail, MapPin, Briefcase, DollarSign, Calendar } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { CrewService, type CrewMember } from "@/lib/crew-service"
import { useAuthReady } from "@/components/auth-hooks"

export default function CrewSheetPage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProject = searchParams.get("movie") || ""
  const { user, userId, ready } = useAuthReady()

  const [projectId, setProjectId] = useState<string>(initialProject)
  const [loading, setLoading] = useState(false)
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([])
  const [isLoadingCrew, setIsLoadingCrew] = useState(false)
  const [isCreatingMember, setIsCreatingMember] = useState(false)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [filterDepartment, setFilterDepartment] = useState<string>("")
  const [filterStatus, setFilterStatus] = useState<string>("")

  // Form fields
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [department, setDepartment] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [alternatePhone, setAlternatePhone] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [country, setCountry] = useState("")
  const [unionStatus, setUnionStatus] = useState<string>("")
  const [rateDaily, setRateDaily] = useState("")
  const [rateHourly, setRateHourly] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [skills, setSkills] = useState("")
  const [certifications, setCertifications] = useState("")
  const [equipmentOwned, setEquipmentOwned] = useState("")
  const [availabilityNotes, setAvailabilityNotes] = useState("")
  const [preferredDays, setPreferredDays] = useState("")
  const [unavailableDates, setUnavailableDates] = useState("")
  const [emergencyContactName, setEmergencyContactName] = useState("")
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("")
  const [emergencyContactRelation, setEmergencyContactRelation] = useState("")
  const [notes, setNotes] = useState("")
  const [internalNotes, setInternalNotes] = useState("")
  const [status, setStatus] = useState<string>("active")

  // Common departments
  const departments = [
    "Camera", "Sound", "Lighting", "Grip", "Electric", "Art Department",
    "Wardrobe", "Hair & Makeup", "Production", "AD Department",
    "Script Supervisor", "Continuity", "Transportation", "Craft Services",
    "Security", "Medical", "Stunts", "VFX", "Post-Production", "Other"
  ]

  // Common roles
  const commonRoles = [
    "Director", "Producer", "Cinematographer", "Camera Operator", "1st AC", "2nd AC",
    "Sound Mixer", "Boom Operator", "Gaffer", "Best Boy Electric", "Key Grip",
    "Best Boy Grip", "Production Designer", "Art Director", "Set Decorator",
    "Wardrobe Supervisor", "Hair Stylist", "Makeup Artist", "1st AD", "2nd AD",
    "Script Supervisor", "Location Manager", "Transportation Coordinator", "Other"
  ]

  // Load data for selected project
  useEffect(() => {
    const load = async () => {
      if (!projectId) return
      setLoading(true)
      try {
        setIsLoadingCrew(true)
        const members = await CrewService.getCrewMembers(projectId)
        setCrewMembers(members)
      } catch (err) {
        console.error("Failed to load crew data:", err)
        toast({
          title: "Error",
          description: "Failed to load crew members. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingCrew(false)
        setLoading(false)
      }
    }
    if (ready && projectId) {
      load()
    }
  }, [projectId, ready, toast])

  // Filter crew members
  const filteredCrew = useMemo(() => {
    let filtered = crewMembers
    if (filterDepartment) {
      filtered = filtered.filter(m => m.department === filterDepartment)
    }
    if (filterStatus) {
      filtered = filtered.filter(m => m.status === filterStatus)
    }
    return filtered
  }, [crewMembers, filterDepartment, filterStatus])

  // Group by department
  const crewByDepartment = useMemo(() => {
    const grouped: Record<string, CrewMember[]> = {}
    filteredCrew.forEach(member => {
      const dept = member.department || "Unassigned"
      if (!grouped[dept]) {
        grouped[dept] = []
      }
      grouped[dept].push(member)
    })
    return grouped
  }, [filteredCrew])

  const handleProjectChange = (id: string) => {
    setProjectId(id)
    setEditingMemberId(null)
    clearForm()
    const url = new URL(window.location.href)
    if (id) {
      url.searchParams.set("movie", id)
    } else {
      url.searchParams.delete("movie")
    }
    router.replace(url.toString())
  }

  const clearForm = () => {
    setName("")
    setRole("")
    setDepartment("")
    setEmail("")
    setPhone("")
    setAlternatePhone("")
    setAddress("")
    setCity("")
    setState("")
    setZipCode("")
    setCountry("")
    setUnionStatus("")
    setRateDaily("")
    setRateHourly("")
    setStartDate("")
    setEndDate("")
    setSkills("")
    setCertifications("")
    setEquipmentOwned("")
    setAvailabilityNotes("")
    setPreferredDays("")
    setUnavailableDates("")
    setEmergencyContactName("")
    setEmergencyContactPhone("")
    setEmergencyContactRelation("")
    setNotes("")
    setInternalNotes("")
    setStatus("active")
    setEditingMemberId(null)
  }

  const loadMemberIntoForm = (member: CrewMember) => {
    setEditingMemberId(member.id)
    setName(member.name || "")
    setRole(member.role || "")
    setDepartment(member.department || "")
    setEmail(member.email || "")
    setPhone(member.phone || "")
    setAlternatePhone(member.alternate_phone || "")
    setAddress(member.address || "")
    setCity(member.city || "")
    setState(member.state || "")
    setZipCode(member.zip_code || "")
    setCountry(member.country || "")
    setUnionStatus(member.union_status || "")
    setRateDaily(member.rate_daily?.toString() || "")
    setRateHourly(member.rate_hourly?.toString() || "")
    setStartDate(member.start_date || "")
    setEndDate(member.end_date || "")
    setSkills((member.skills || []).join(", "))
    setCertifications((member.certifications || []).join(", "))
    setEquipmentOwned((member.equipment_owned || []).join(", "))
    setAvailabilityNotes(member.availability_notes || "")
    setPreferredDays((member.preferred_days || []).join(", "))
    setUnavailableDates((member.unavailable_dates || []).join(", "))
    setEmergencyContactName(member.emergency_contact_name || "")
    setEmergencyContactPhone(member.emergency_contact_phone || "")
    setEmergencyContactRelation(member.emergency_contact_relation || "")
    setNotes(member.notes || "")
    setInternalNotes(member.internal_notes || "")
    setStatus(member.status || "active")
  }

  const createOrUpdateMember = async () => {
    if (!projectId) return
    const nameValue = name.trim()
    if (!nameValue) {
      toast({ title: "Name required", description: "Please enter a crew member name.", variant: "destructive" })
      return
    }
    if (!role.trim()) {
      toast({ title: "Role required", description: "Please enter a role.", variant: "destructive" })
      return
    }

    try {
      setIsCreatingMember(true)

      const parseArray = (str: string) => str.split(",").map(s => s.trim()).filter(Boolean)
      const parseDateArray = (str: string) => {
        if (!str.trim()) return undefined
        return str.split(",").map(s => s.trim()).filter(Boolean)
      }

      const memberData: any = {
        project_id: projectId,
        name: nameValue,
        role: role.trim(),
        department: department || undefined,
        email: email || undefined,
        phone: phone || undefined,
        alternate_phone: alternatePhone || undefined,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        zip_code: zipCode || undefined,
        country: country || undefined,
        union_status: unionStatus || undefined,
        rate_daily: rateDaily ? parseFloat(rateDaily) : undefined,
        rate_hourly: rateHourly ? parseFloat(rateHourly) : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        skills: skills ? parseArray(skills) : undefined,
        certifications: certifications ? parseArray(certifications) : undefined,
        equipment_owned: equipmentOwned ? parseArray(equipmentOwned) : undefined,
        availability_notes: availabilityNotes || undefined,
        preferred_days: preferredDays ? parseArray(preferredDays) : undefined,
        unavailable_dates: parseDateArray(unavailableDates),
        emergency_contact_name: emergencyContactName || undefined,
        emergency_contact_phone: emergencyContactPhone || undefined,
        emergency_contact_relation: emergencyContactRelation || undefined,
        notes: notes || undefined,
        internal_notes: internalNotes || undefined,
        status: status || "active",
      }

      // Remove undefined values
      Object.keys(memberData).forEach(key => {
        if (memberData[key] === undefined) {
          delete memberData[key]
        }
      })

      if (editingMemberId) {
        const updated = await CrewService.updateCrewMember(editingMemberId, memberData)
        setCrewMembers(prev => prev.map(m => m.id === editingMemberId ? updated : m))
        toast({ title: "Crew member updated", description: `"${updated.name}" saved.` })
      } else {
        const created = await CrewService.createCrewMember(memberData)
        setCrewMembers([created, ...crewMembers])
        toast({ title: "Crew member added", description: `"${created.name}" added to crew.` })
      }

      clearForm()
    } catch (err) {
      console.error('Create/update crew member failed:', err)
      toast({
        title: "Error",
        description: editingMemberId ? "Failed to update crew member." : "Failed to add crew member.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingMember(false)
    }
  }

  const deleteMember = async (id: string) => {
    if (!confirm("Delete this crew member? This cannot be undone.")) return
    try {
      await CrewService.deleteCrewMember(id)
      setCrewMembers(prev => prev.filter(m => m.id !== id))
      if (editingMemberId === id) {
        clearForm()
      }
      toast({ title: "Deleted", description: "Crew member removed." })
    } catch (e) {
      console.error('Delete crew member failed:', e)
      toast({ title: "Error", description: "Failed to delete crew member.", variant: "destructive" })
    }
  }

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'inactive': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getUnionStatusColor = (status?: string | null) => {
    switch (status) {
      case 'union': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'non-union': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      case 'fi-core': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-400 bg-clip-text text-transparent">
              Crew Sheet
            </h1>
            <p className="text-muted-foreground">
              Manage your production crew roster and contact information.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <ProjectSelector
            selectedProject={projectId}
            onProjectChange={handleProjectChange}
            placeholder="Select a movie to manage crew"
          />
        </div>

        {!projectId ? (
          <Card className="cinema-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              Select a movie to view and manage crew members.
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading crew members...
          </div>
        ) : (
          <>
            {/* Filters */}
            <Card className="cinema-card mb-6">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={filterDepartment || "__all__"} onValueChange={(value) => setFilterDepartment(value === "__all__" ? "" : value)}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="All departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All departments</SelectItem>
                        {Array.from(new Set(crewMembers.map(m => m.department).filter(Boolean))).map(dept => (
                          <SelectItem key={dept} value={dept!}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={filterStatus || "__all__"} onValueChange={(value) => setFilterStatus(value === "__all__" ? "" : value)}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Create/Edit Form */}
            <Card className="cinema-card mb-6">
              <CardHeader>
                <CardTitle>
                  {editingMemberId ? "Edit Crew Member" : "Add New Crew Member"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-input border-border"
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role *</Label>
                      <Select value={role || "__none__"} onValueChange={(value) => setRole(value === "__none__" ? "" : value)}>
                        <SelectTrigger id="role" className="bg-input border-border">
                          <SelectValue placeholder="Select or enter role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {commonRoles.map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!commonRoles.includes(role) && role && (
                        <Input
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          className="bg-input border-border mt-2"
                          placeholder="Custom role"
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Select value={department || "__none__"} onValueChange={(value) => setDepartment(value === "__none__" ? "" : value)}>
                        <SelectTrigger id="department" className="bg-input border-border">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {departments.map(d => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-input border-border"
                        placeholder="john@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="bg-input border-border"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="alternate-phone">Alternate Phone</Label>
                      <Input
                        id="alternate-phone"
                        type="tel"
                        value={alternatePhone}
                        onChange={(e) => setAlternatePhone(e.target.value)}
                        className="bg-input border-border"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="bg-input border-border"
                        placeholder="Street address"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State/Province</Label>
                      <Input
                        id="state"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zip">Zip/Postal Code</Label>
                      <Input
                        id="zip"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Professional Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Professional Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="union-status">Union Status</Label>
                      <Select value={unionStatus || "__none__"} onValueChange={(value) => setUnionStatus(value === "__none__" ? "" : value)}>
                        <SelectTrigger id="union-status" className="bg-input border-border">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          <SelectItem value="union">Union</SelectItem>
                          <SelectItem value="non-union">Non-Union</SelectItem>
                          <SelectItem value="fi-core">FI-Core</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={status || "__active__"} onValueChange={(value) => setStatus(value === "__active__" ? "active" : value)}>
                        <SelectTrigger id="status" className="bg-input border-border">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rate-daily">Daily Rate ($)</Label>
                      <Input
                        id="rate-daily"
                        type="number"
                        step="0.01"
                        value={rateDaily}
                        onChange={(e) => setRateDaily(e.target.value)}
                        className="bg-input border-border"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rate-hourly">Hourly Rate ($)</Label>
                      <Input
                        id="rate-hourly"
                        type="number"
                        step="0.01"
                        value={rateHourly}
                        onChange={(e) => setRateHourly(e.target.value)}
                        className="bg-input border-border"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="start-date">Start Date</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date">End Date</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Skills & Equipment */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Skills & Equipment</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="skills">Skills (comma-separated)</Label>
                      <Input
                        id="skills"
                        value={skills}
                        onChange={(e) => setSkills(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., Steadicam, Drone, Underwater"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="certifications">Certifications (comma-separated)</Label>
                      <Input
                        id="certifications"
                        value={certifications}
                        onChange={(e) => setCertifications(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., OSHA, First Aid, CDL"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="equipment">Equipment Owned (comma-separated)</Label>
                      <Input
                        id="equipment"
                        value={equipmentOwned}
                        onChange={(e) => setEquipmentOwned(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., Camera, Lenses, Tripod"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Availability */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Availability</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="preferred-days">Preferred Days (comma-separated)</Label>
                      <Input
                        id="preferred-days"
                        value={preferredDays}
                        onChange={(e) => setPreferredDays(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., Monday, Tuesday, Wednesday"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unavailable-dates">Unavailable Dates (comma-separated YYYY-MM-DD)</Label>
                      <Input
                        id="unavailable-dates"
                        value={unavailableDates}
                        onChange={(e) => setUnavailableDates(e.target.value)}
                        className="bg-input border-border"
                        placeholder="2025-01-15, 2025-01-20"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="availability-notes">Availability Notes</Label>
                      <Textarea
                        id="availability-notes"
                        value={availabilityNotes}
                        onChange={(e) => setAvailabilityNotes(e.target.value)}
                        className="bg-input border-border min-h-[60px]"
                        placeholder="Additional availability information..."
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Emergency Contact */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Emergency Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="emergency-name">Contact Name</Label>
                      <Input
                        id="emergency-name"
                        value={emergencyContactName}
                        onChange={(e) => setEmergencyContactName(e.target.value)}
                        className="bg-input border-border"
                        placeholder="Jane Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergency-phone">Contact Phone</Label>
                      <Input
                        id="emergency-phone"
                        type="tel"
                        value={emergencyContactPhone}
                        onChange={(e) => setEmergencyContactPhone(e.target.value)}
                        className="bg-input border-border"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergency-relation">Relation</Label>
                      <Input
                        id="emergency-relation"
                        value={emergencyContactRelation}
                        onChange={(e) => setEmergencyContactRelation(e.target.value)}
                        className="bg-input border-border"
                        placeholder="Spouse, Parent, etc."
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Notes */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Notes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="notes">Public Notes</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="bg-input border-border min-h-[80px]"
                        placeholder="General notes about the crew member..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="internal-notes">Internal Notes</Label>
                      <Textarea
                        id="internal-notes"
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                        className="bg-input border-border min-h-[80px]"
                        placeholder="Private/internal notes (not shared)..."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={createOrUpdateMember}
                    disabled={isCreatingMember || !name.trim() || !role.trim()}
                    className="gap-2"
                  >
                    {isCreatingMember ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : editingMemberId ? (
                      <Save className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {editingMemberId ? "Update Crew Member" : "Add Crew Member"}
                  </Button>
                  {editingMemberId && (
                    <Button variant="outline" onClick={clearForm} disabled={isCreatingMember} className="gap-2">
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Crew Members List */}
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Crew Roster
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {isLoadingCrew
                    ? "Loading..."
                    : `${filteredCrew.length} crew member${filteredCrew.length === 1 ? "" : "s"}`}
                </p>
              </CardHeader>
              <CardContent>
                {isLoadingCrew ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-8">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading crew members...
                  </div>
                ) : filteredCrew.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    No crew members yet. Add your first crew member above.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(crewByDepartment).map(([dept, members]) => (
                      <div key={dept} className="space-y-3">
                        <h3 className="text-lg font-semibold border-b border-border pb-2">
                          {dept} ({members.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {members.map((member) => (
                            <div
                              key={member.id}
                              className="p-4 border border-border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                            >
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-base">{member.name}</h4>
                                    <p className="text-sm text-muted-foreground">{member.role}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => loadMemberIntoForm(member)}
                                      title="Edit"
                                      className="h-7 w-7"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => deleteMember(member.id)}
                                      title="Delete"
                                      className="h-7 w-7 text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                
                                <div className="flex flex-wrap gap-1">
                                  <Badge className={getStatusColor(member.status)}>
                                    {member.status || 'active'}
                                  </Badge>
                                  {member.union_status && (
                                    <Badge className={getUnionStatusColor(member.union_status)}>
                                      {member.union_status}
                                    </Badge>
                                  )}
                                </div>

                                <div className="space-y-1 text-xs text-muted-foreground">
                                  {member.email && (
                                    <div className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      <span className="truncate">{member.email}</span>
                                    </div>
                                  )}
                                  {member.phone && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      <span>{member.phone}</span>
                                    </div>
                                  )}
                                  {member.rate_daily && (
                                    <div className="flex items-center gap-1">
                                      <DollarSign className="h-3 w-3" />
                                      <span>${member.rate_daily}/day</span>
                                    </div>
                                  )}
                                </div>

                                {member.skills && member.skills.length > 0 && (
                                  <div className="pt-2 border-t border-border">
                                    <p className="text-xs text-muted-foreground">
                                      <span className="font-medium">Skills: </span>
                                      {member.skills.slice(0, 3).join(", ")}
                                      {member.skills.length > 3 && ` +${member.skills.length - 3} more`}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

