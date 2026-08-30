import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateCompany } from "@/hooks/useCompanies";
import { useAllPeople, useAllLeads, useUpdateCompanyPeople, useUpdateCompanyLeads } from "@/hooks/useCompanyRelations";
import { Building2, X, Users, Target } from "lucide-react";

interface NovaEmpresaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (empresa: any) => void;
}

const NovaEmpresaModal = ({ open, onOpenChange, onSuccess }: NovaEmpresaModalProps) => {
  const [formData, setFormData] = useState({
    trade_name: "",
    legal_name: "",
    tax_id: "",
    email: "",
    phone: "",
    website: "",
    address: "",
  });
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  const createCompany = useCreateCompany();
  const updateCompanyPeople = useUpdateCompanyPeople();
  const updateCompanyLeads = useUpdateCompanyLeads();
  const { data: allPeople = [] } = useAllPeople();
  const { data: allLeads = [] } = useAllLeads();

  const availablePeople = allPeople.filter(p => !selectedPeopleIds.includes(p.id));
  const availableLeads = allLeads.filter(l => !selectedLeadIds.includes(l.id));

  const handleSubmit = async () => {
    if (!formData.trade_name.trim()) {
      return;
    }

    try {
      const result = await createCompany.mutateAsync(formData);
      
      // Link people to company
      if (selectedPeopleIds.length > 0) {
        await updateCompanyPeople.mutateAsync({
          companyId: result.id,
          peopleIds: selectedPeopleIds,
        });
      }
      
      // Link leads to company
      if (selectedLeadIds.length > 0) {
        await updateCompanyLeads.mutateAsync({
          companyId: result.id,
          leadIds: selectedLeadIds,
        });
      }
      
      handleClose();
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      console.error("Error creating company:", error);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData({
      trade_name: "",
      legal_name: "",
      tax_id: "",
      email: "",
      phone: "",
      website: "",
      address: "",
    });
    setSelectedPeopleIds([]);
    setSelectedLeadIds([]);
  };

  const handleAddPerson = (personId: string) => {
    if (personId && !selectedPeopleIds.includes(personId)) {
      setSelectedPeopleIds(prev => [...prev, personId]);
    }
  };

  const handleRemovePerson = (personId: string) => {
    setSelectedPeopleIds(prev => prev.filter(id => id !== personId));
  };

  const handleAddLead = (leadId: string) => {
    if (leadId && !selectedLeadIds.includes(leadId)) {
      setSelectedLeadIds(prev => [...prev, leadId]);
    }
  };

  const handleRemoveLead = (leadId: string) => {
    setSelectedLeadIds(prev => prev.filter(id => id !== leadId));
  };

  const getPersonName = (id: string) => allPeople.find(p => p.id === id)?.name || '';
  const getLeadTitle = (id: string) => {
    const lead = allLeads.find(l => l.id === id);
    return lead?.title || lead?.person?.name || 'Lead sem título';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-[2px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg font-semibold text-foreground">Nova Empresa</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Preencha os dados da empresa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="trade_name" className="text-sm font-medium text-foreground">
                Nome Fantasia *
              </Label>
              <Input
                id="trade_name"
                value={formData.trade_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, trade_name: e.target.value }))}
                placeholder="Nome fantasia da empresa"
                className="mt-2 rounded-[4px]"
              />
            </div>

            <div>
              <Label htmlFor="legal_name" className="text-sm font-medium text-foreground">
                Razão Social
              </Label>
              <Input
                id="legal_name"
                value={formData.legal_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, legal_name: e.target.value }))}
                placeholder="Razão social"
                className="mt-2 rounded-[4px]"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="tax_id" className="text-sm font-medium text-foreground">
              CNPJ
            </Label>
            <Input
              id="tax_id"
              value={formData.tax_id}
              onChange={(e) => setFormData((prev) => ({ ...prev, tax_id: e.target.value }))}
              placeholder="00.000.000/0000-00"
              className="mt-2 rounded-[4px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="contato@empresa.com"
                className="mt-2 rounded-[4px]"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-sm font-medium text-foreground">
                Telefone
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
                className="mt-2 rounded-[4px]"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="website" className="text-sm font-medium text-foreground">
              Website
            </Label>
            <Input
              id="website"
              value={formData.website}
              onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
              placeholder="https://www.empresa.com"
              className="mt-2 rounded-[4px]"
            />
          </div>

          <div>
            <Label htmlFor="address" className="text-sm font-medium text-foreground">
              Endereço
            </Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Endereço completo"
              rows={2}
              className="mt-2 rounded-[4px]"
            />
          </div>

          {/* People Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Pessoas Vinculadas
            </Label>
            <Select onValueChange={handleAddPerson} value="">
              <SelectTrigger className="rounded-[4px]">
                <SelectValue placeholder="Selecione pessoas para vincular..." />
              </SelectTrigger>
              <SelectContent>
                {availablePeople.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name} {person.email && `(${person.email})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPeopleIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedPeopleIds.map((id) => (
                  <Badge key={id} variant="secondary" className="flex items-center gap-1">
                    {getPersonName(id)}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => handleRemovePerson(id)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Leads Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Leads Vinculados
            </Label>
            <Select onValueChange={handleAddLead} value="">
              <SelectTrigger className="rounded-[4px]">
                <SelectValue placeholder="Selecione leads para vincular..." />
              </SelectTrigger>
              <SelectContent>
                {availableLeads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.title || lead.person?.name || 'Lead sem título'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedLeadIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedLeadIds.map((id) => (
                  <Badge key={id} variant="secondary" className="flex items-center gap-1">
                    {getLeadTitle(id)}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => handleRemoveLead(id)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} className="rounded-[4px]">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createCompany.isPending || !formData.trade_name.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-[4px]"
          >
            {createCompany.isPending ? "Criando..." : "Criar Empresa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NovaEmpresaModal;
