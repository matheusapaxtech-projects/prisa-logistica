export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      arquivo: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mime: string | null
          nome_original: string | null
          numero: string | null
          pessoa_id: string | null
          restrito: boolean
          storage_path: string
          tamanho_bytes: number | null
          tipo_arquivo_id: number
          updated_at: string
          updated_by: string | null
          validade: string | null
          validado_em: string | null
          validado_por: string | null
          veiculo_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mime?: string | null
          nome_original?: string | null
          numero?: string | null
          pessoa_id?: string | null
          restrito?: boolean
          storage_path: string
          tamanho_bytes?: number | null
          tipo_arquivo_id: number
          updated_at?: string
          updated_by?: string | null
          validade?: string | null
          validado_em?: string | null
          validado_por?: string | null
          veiculo_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mime?: string | null
          nome_original?: string | null
          numero?: string | null
          pessoa_id?: string | null
          restrito?: boolean
          storage_path?: string
          tamanho_bytes?: number | null
          tipo_arquivo_id?: number
          updated_at?: string
          updated_by?: string | null
          validade?: string | null
          validado_em?: string | null
          validado_por?: string | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arquivo_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arquivo_tipo_arquivo_id_fkey"
            columns: ["tipo_arquivo_id"]
            isOneToOne: false
            referencedRelation: "tipo_arquivo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arquivo_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculo"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          acao: string
          dados_antes: Json | null
          dados_depois: Json | null
          em: string
          id: number
          registro_id: string
          tabela: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          em?: string
          id?: never
          registro_id: string
          tabela: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          em?: string
          id?: never
          registro_id?: string
          tabela?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      banco: {
        Row: {
          codigo: string
          nome: string
        }
        Insert: {
          codigo: string
          nome: string
        }
        Update: {
          codigo?: string
          nome?: string
        }
        Relationships: []
      }
      centro_custo: {
        Row: {
          id: number
          nome: string
        }
        Insert: {
          id?: number
          nome: string
        }
        Update: {
          id?: number
          nome?: string
        }
        Relationships: []
      }
      conjunto: {
        Row: {
          cavalo_id: string
          created_at: string
          created_by: string | null
          fim: string | null
          id: string
          inicio: string
          motorista_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cavalo_id: string
          created_at?: string
          created_by?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          motorista_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cavalo_id?: string
          created_at?: string
          created_by?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          motorista_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conjunto_cavalo_id_fkey"
            columns: ["cavalo_id"]
            isOneToOne: false
            referencedRelation: "veiculo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conjunto_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motorista"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "conjunto_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "v_motorista_situacao"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      conjunto_item: {
        Row: {
          conjunto_id: string
          posicao: number
          veiculo_id: string
        }
        Insert: {
          conjunto_id: string
          posicao: number
          veiculo_id: string
        }
        Update: {
          conjunto_id?: string
          posicao?: number
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conjunto_item_conjunto_id_fkey"
            columns: ["conjunto_id"]
            isOneToOne: false
            referencedRelation: "conjunto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conjunto_item_conjunto_id_fkey"
            columns: ["conjunto_id"]
            isOneToOne: false
            referencedRelation: "v_conjunto_capacidade"
            referencedColumns: ["conjunto_id"]
          },
          {
            foreignKeyName: "conjunto_item_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculo"
            referencedColumns: ["id"]
          },
        ]
      }
      marca_veiculo: {
        Row: {
          id: number
          nome: string
        }
        Insert: {
          id?: number
          nome: string
        }
        Update: {
          id?: number
          nome?: string
        }
        Relationships: []
      }
      motorista: {
        Row: {
          cnh_categoria: Database["public"]["Enums"]["categoria_cnh"] | null
          cnh_cidade_emissao: string | null
          cnh_emissao: string | null
          cnh_formulario: string | null
          cnh_observacao: string | null
          cnh_primeira_habilitacao: string | null
          cnh_registro: string | null
          cnh_renach: string | null
          cnh_seguranca: string | null
          cnh_uf: Database["public"]["Enums"]["uf"] | null
          cnh_validade: string | null
          created_at: string
          created_by: string | null
          dt_qualificacao_gmp: string | null
          gr_validade: string | null
          pessoa_id: string
          qualificado_gmp: boolean | null
          radio: string | null
          situacao_cadastro: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_gr: Database["public"]["Enums"]["situacao_gr"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cnh_categoria?: Database["public"]["Enums"]["categoria_cnh"] | null
          cnh_cidade_emissao?: string | null
          cnh_emissao?: string | null
          cnh_formulario?: string | null
          cnh_observacao?: string | null
          cnh_primeira_habilitacao?: string | null
          cnh_registro?: string | null
          cnh_renach?: string | null
          cnh_seguranca?: string | null
          cnh_uf?: Database["public"]["Enums"]["uf"] | null
          cnh_validade?: string | null
          created_at?: string
          created_by?: string | null
          dt_qualificacao_gmp?: string | null
          gr_validade?: string | null
          pessoa_id: string
          qualificado_gmp?: boolean | null
          radio?: string | null
          situacao_cadastro?: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_gr?: Database["public"]["Enums"]["situacao_gr"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cnh_categoria?: Database["public"]["Enums"]["categoria_cnh"] | null
          cnh_cidade_emissao?: string | null
          cnh_emissao?: string | null
          cnh_formulario?: string | null
          cnh_observacao?: string | null
          cnh_primeira_habilitacao?: string | null
          cnh_registro?: string | null
          cnh_renach?: string | null
          cnh_seguranca?: string | null
          cnh_uf?: Database["public"]["Enums"]["uf"] | null
          cnh_validade?: string | null
          created_at?: string
          created_by?: string | null
          dt_qualificacao_gmp?: string | null
          gr_validade?: string | null
          pessoa_id?: string
          qualificado_gmp?: boolean | null
          radio?: string | null
          situacao_cadastro?: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_gr?: Database["public"]["Enums"]["situacao_gr"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motorista_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: true
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      motorista_referencia: {
        Row: {
          created_at: string
          created_by: string | null
          dt_referencia: string | null
          id: string
          motorista_id: string
          nome: string
          observacao: string | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_referencia"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dt_referencia?: string | null
          id?: string
          motorista_id: string
          nome: string
          observacao?: string | null
          telefone?: string | null
          tipo: Database["public"]["Enums"]["tipo_referencia"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dt_referencia?: string | null
          id?: string
          motorista_id?: string
          nome?: string
          observacao?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_referencia"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motorista_referencia_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motorista"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "motorista_referencia_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "v_motorista_situacao"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      operadora_tag: {
        Row: {
          id: number
          nome: string
        }
        Insert: {
          id?: number
          nome: string
        }
        Update: {
          id?: number
          nome?: string
        }
        Relationships: []
      }
      perfil_usuario: {
        Row: {
          ativo: boolean
          created_at: string
          nome: string
          papel: Database["public"]["Enums"]["app_papel"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          nome: string
          papel: Database["public"]["Enums"]["app_papel"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          nome?: string
          papel?: Database["public"]["Enums"]["app_papel"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pessoa: {
        Row: {
          apelido: string | null
          cnae_principal: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          dados_brasilapi: Json | null
          dt_consulta_brasilapi: string | null
          dt_consulta_cpf: string | null
          dt_consulta_simples: string | null
          estado_civil: Database["public"]["Enums"]["estado_civil"] | null
          fundacao: string | null
          grau_instrucao: Database["public"]["Enums"]["grau_instrucao"] | null
          id: string
          inscricao_estadual: string | null
          inscricao_estadual_isento: boolean | null
          inscricao_municipal: string | null
          mae: string | null
          nascimento: string | null
          naturalidade: string | null
          naturalidade_uf: Database["public"]["Enums"]["uf"] | null
          natureza_juridica: string | null
          nome: string
          nome_fantasia: string | null
          nr_dependentes: number | null
          nr_inss: string | null
          observacao: string | null
          optante_simples: boolean | null
          pai: string | null
          qualificacao_inss: string | null
          raca_cor: Database["public"]["Enums"]["raca_cor"] | null
          rg: string | null
          rg_emissao: string | null
          rg_orgao: string | null
          rg_uf: Database["public"]["Enums"]["uf"] | null
          sexo: Database["public"]["Enums"]["sexo"] | null
          situacao_cadastro: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_cpf: Database["public"]["Enums"]["situacao_cpf"] | null
          tipo: Database["public"]["Enums"]["tipo_pessoa"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          apelido?: string | null
          cnae_principal?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          dados_brasilapi?: Json | null
          dt_consulta_brasilapi?: string | null
          dt_consulta_cpf?: string | null
          dt_consulta_simples?: string | null
          estado_civil?: Database["public"]["Enums"]["estado_civil"] | null
          fundacao?: string | null
          grau_instrucao?: Database["public"]["Enums"]["grau_instrucao"] | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_estadual_isento?: boolean | null
          inscricao_municipal?: string | null
          mae?: string | null
          nascimento?: string | null
          naturalidade?: string | null
          naturalidade_uf?: Database["public"]["Enums"]["uf"] | null
          natureza_juridica?: string | null
          nome: string
          nome_fantasia?: string | null
          nr_dependentes?: number | null
          nr_inss?: string | null
          observacao?: string | null
          optante_simples?: boolean | null
          pai?: string | null
          qualificacao_inss?: string | null
          raca_cor?: Database["public"]["Enums"]["raca_cor"] | null
          rg?: string | null
          rg_emissao?: string | null
          rg_orgao?: string | null
          rg_uf?: Database["public"]["Enums"]["uf"] | null
          sexo?: Database["public"]["Enums"]["sexo"] | null
          situacao_cadastro?: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_cpf?: Database["public"]["Enums"]["situacao_cpf"] | null
          tipo: Database["public"]["Enums"]["tipo_pessoa"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          apelido?: string | null
          cnae_principal?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          dados_brasilapi?: Json | null
          dt_consulta_brasilapi?: string | null
          dt_consulta_cpf?: string | null
          dt_consulta_simples?: string | null
          estado_civil?: Database["public"]["Enums"]["estado_civil"] | null
          fundacao?: string | null
          grau_instrucao?: Database["public"]["Enums"]["grau_instrucao"] | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_estadual_isento?: boolean | null
          inscricao_municipal?: string | null
          mae?: string | null
          nascimento?: string | null
          naturalidade?: string | null
          naturalidade_uf?: Database["public"]["Enums"]["uf"] | null
          natureza_juridica?: string | null
          nome?: string
          nome_fantasia?: string | null
          nr_dependentes?: number | null
          nr_inss?: string | null
          observacao?: string | null
          optante_simples?: boolean | null
          pai?: string | null
          qualificacao_inss?: string | null
          raca_cor?: Database["public"]["Enums"]["raca_cor"] | null
          rg?: string | null
          rg_emissao?: string | null
          rg_orgao?: string | null
          rg_uf?: Database["public"]["Enums"]["uf"] | null
          sexo?: Database["public"]["Enums"]["sexo"] | null
          situacao_cadastro?: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_cpf?: Database["public"]["Enums"]["situacao_cpf"] | null
          tipo?: Database["public"]["Enums"]["tipo_pessoa"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pessoa_chave_pix: {
        Row: {
          chave: string
          conta_id: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          pessoa_id: string
          principal: boolean
          tipo: Database["public"]["Enums"]["tipo_chave_pix"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          chave: string
          conta_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          pessoa_id: string
          principal?: boolean
          tipo: Database["public"]["Enums"]["tipo_chave_pix"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          chave?: string
          conta_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          pessoa_id?: string
          principal?: boolean
          tipo?: Database["public"]["Enums"]["tipo_chave_pix"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_chave_pix_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "pessoa_conta_bancaria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_chave_pix_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa_conta_bancaria: {
        Row: {
          agencia: string | null
          agencia_digito: string | null
          banco_codigo: string | null
          conta: string | null
          conta_digito: string | null
          created_at: string
          created_by: string | null
          favorecido_documento: string | null
          favorecido_nome: string | null
          id: string
          pessoa_id: string
          principal: boolean
          swift: string | null
          tipo: Database["public"]["Enums"]["tipo_conta"] | null
          titular_confere: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agencia?: string | null
          agencia_digito?: string | null
          banco_codigo?: string | null
          conta?: string | null
          conta_digito?: string | null
          created_at?: string
          created_by?: string | null
          favorecido_documento?: string | null
          favorecido_nome?: string | null
          id?: string
          pessoa_id: string
          principal?: boolean
          swift?: string | null
          tipo?: Database["public"]["Enums"]["tipo_conta"] | null
          titular_confere?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agencia?: string | null
          agencia_digito?: string | null
          banco_codigo?: string | null
          conta?: string | null
          conta_digito?: string | null
          created_at?: string
          created_by?: string | null
          favorecido_documento?: string | null
          favorecido_nome?: string | null
          id?: string
          pessoa_id?: string
          principal?: boolean
          swift?: string | null
          tipo?: Database["public"]["Enums"]["tipo_conta"] | null
          titular_confere?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_conta_bancaria_banco_codigo_fkey"
            columns: ["banco_codigo"]
            isOneToOne: false
            referencedRelation: "banco"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "pessoa_conta_bancaria_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa_email: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          observacao: string | null
          pessoa_id: string
          principal: boolean
          recebe_cte: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          observacao?: string | null
          pessoa_id: string
          principal?: boolean
          recebe_cte?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          observacao?: string | null
          pessoa_id?: string
          principal?: boolean
          recebe_cte?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_email_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa_endereco: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string
          complemento: string | null
          created_at: string
          created_by: string | null
          id: string
          latitude: number | null
          logradouro: string | null
          longitude: number | null
          numero: string | null
          pessoa_id: string
          ponto_referencia: string | null
          principal: boolean
          tipo: Database["public"]["Enums"]["tipo_endereco"] | null
          uf: Database["public"]["Enums"]["uf"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade: string
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          numero?: string | null
          pessoa_id: string
          ponto_referencia?: string | null
          principal?: boolean
          tipo?: Database["public"]["Enums"]["tipo_endereco"] | null
          uf: Database["public"]["Enums"]["uf"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          numero?: string | null
          pessoa_id?: string
          ponto_referencia?: string | null
          principal?: boolean
          tipo?: Database["public"]["Enums"]["tipo_endereco"] | null
          uf?: Database["public"]["Enums"]["uf"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_endereco_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa_telefone: {
        Row: {
          contato: string | null
          created_at: string
          created_by: string | null
          id: string
          numero: string
          pessoa_id: string
          principal: boolean
          ramal: string | null
          restrito: boolean
          tipo: Database["public"]["Enums"]["tipo_telefone"] | null
          updated_at: string
          updated_by: string | null
          whatsapp: boolean
        }
        Insert: {
          contato?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          numero: string
          pessoa_id: string
          principal?: boolean
          ramal?: string | null
          restrito?: boolean
          tipo?: Database["public"]["Enums"]["tipo_telefone"] | null
          updated_at?: string
          updated_by?: string | null
          whatsapp?: boolean
        }
        Update: {
          contato?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          numero?: string
          pessoa_id?: string
          principal?: boolean
          ramal?: string | null
          restrito?: boolean
          tipo?: Database["public"]["Enums"]["tipo_telefone"] | null
          updated_at?: string
          updated_by?: string | null
          whatsapp?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_telefone_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      proprietario: {
        Row: {
          alto_desempenho: boolean
          autoriza_desconto_inss: Database["public"]["Enums"]["desconto_inss"]
          created_at: string
          created_by: string | null
          dt_qualificacao_gmp: string | null
          enquadramento_antt:
            | Database["public"]["Enums"]["enquadramento_antt"]
            | null
          frete_empresa_motorista_percentual: number | null
          frete_empresa_motorista_valor: number | null
          limite_adiantamento_percentual: number | null
          limite_adiantamento_valor: number | null
          pessoa_id: string
          qualificado_gmp: boolean | null
          regra_pgto_frete:
            | Database["public"]["Enums"]["regra_pgto_frete"]
            | null
          responsavel_email: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          responsavel_whatsapp: boolean | null
          rntrc: string | null
          rntrc_emissao: string | null
          rntrc_validade: string | null
          situacao_cadastro: Database["public"]["Enums"]["situacao_cadastro"]
          taxa_adm_percentual: number | null
          taxa_adm_valor: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alto_desempenho?: boolean
          autoriza_desconto_inss?: Database["public"]["Enums"]["desconto_inss"]
          created_at?: string
          created_by?: string | null
          dt_qualificacao_gmp?: string | null
          enquadramento_antt?:
            | Database["public"]["Enums"]["enquadramento_antt"]
            | null
          frete_empresa_motorista_percentual?: number | null
          frete_empresa_motorista_valor?: number | null
          limite_adiantamento_percentual?: number | null
          limite_adiantamento_valor?: number | null
          pessoa_id: string
          qualificado_gmp?: boolean | null
          regra_pgto_frete?:
            | Database["public"]["Enums"]["regra_pgto_frete"]
            | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          responsavel_whatsapp?: boolean | null
          rntrc?: string | null
          rntrc_emissao?: string | null
          rntrc_validade?: string | null
          situacao_cadastro?: Database["public"]["Enums"]["situacao_cadastro"]
          taxa_adm_percentual?: number | null
          taxa_adm_valor?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alto_desempenho?: boolean
          autoriza_desconto_inss?: Database["public"]["Enums"]["desconto_inss"]
          created_at?: string
          created_by?: string | null
          dt_qualificacao_gmp?: string | null
          enquadramento_antt?:
            | Database["public"]["Enums"]["enquadramento_antt"]
            | null
          frete_empresa_motorista_percentual?: number | null
          frete_empresa_motorista_valor?: number | null
          limite_adiantamento_percentual?: number | null
          limite_adiantamento_valor?: number | null
          pessoa_id?: string
          qualificado_gmp?: boolean | null
          regra_pgto_frete?:
            | Database["public"]["Enums"]["regra_pgto_frete"]
            | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          responsavel_whatsapp?: boolean | null
          rntrc?: string | null
          rntrc_emissao?: string | null
          rntrc_validade?: string | null
          situacao_cadastro?: Database["public"]["Enums"]["situacao_cadastro"]
          taxa_adm_percentual?: number | null
          taxa_adm_valor?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proprietario_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: true
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      tipo_arquivo: {
        Row: {
          aplica_pessoa: boolean
          aplica_veiculo: boolean
          id: number
          nome: string
        }
        Insert: {
          aplica_pessoa?: boolean
          aplica_veiculo?: boolean
          id?: number
          nome: string
        }
        Update: {
          aplica_pessoa?: boolean
          aplica_veiculo?: boolean
          id?: number
          nome?: string
        }
        Relationships: []
      }
      tipo_veiculo: {
        Row: {
          categoria: Database["public"]["Enums"]["categoria_veiculo"]
          configuracao_cavalo:
            | Database["public"]["Enums"]["configuracao_cavalo"]
            | null
          eixos: number
          id: number
          nome: string
        }
        Insert: {
          categoria: Database["public"]["Enums"]["categoria_veiculo"]
          configuracao_cavalo?:
            | Database["public"]["Enums"]["configuracao_cavalo"]
            | null
          eixos: number
          id?: number
          nome: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["categoria_veiculo"]
          configuracao_cavalo?:
            | Database["public"]["Enums"]["configuracao_cavalo"]
            | null
          eixos?: number
          id?: number
          nome?: string
        }
        Relationships: []
      }
      unidade_operacional: {
        Row: {
          id: number
          nome: string
        }
        Insert: {
          id?: number
          nome: string
        }
        Update: {
          id?: number
          nome?: string
        }
        Relationships: []
      }
      veiculo: {
        Row: {
          altura_m: number | null
          ano_fabricacao: number | null
          ano_modelo: number | null
          apolice: string | null
          aquisicao: string | null
          arrendado: boolean | null
          capacidade_carga_t: number | null
          centro_custo_id: number | null
          chassi: string | null
          cidade_emplacamento: string | null
          cmt_t: number | null
          comprimento_m: number | null
          cor: string | null
          created_at: string
          created_by: string | null
          dt_emissao_crlv: string | null
          exercicio_doc: number | null
          hp: number | null
          id: string
          km_inicial: number | null
          largura_m: number | null
          litros_tanque: number | null
          marca_id: number | null
          media_padrao_carregado: number | null
          media_padrao_vazio: number | null
          modelo: string | null
          nr_certificado_doc: string | null
          nr_frota: string | null
          nr_motor: string | null
          nr_registro_crlv: string | null
          nr_seguranca_crlv: string | null
          observacao: string | null
          pbt_t: number | null
          pgr_sm_automatica: boolean | null
          placa: string
          potencia_motor: string | null
          proprietario_documento_id: string
          proprietario_posse_id: string
          rastreador_empresa: string | null
          rastreador_modelo: string | null
          rastreador_numero: string | null
          rastreador_observacao: string | null
          rastreamento_tipo:
            | Database["public"]["Enums"]["tipo_rastreamento"]
            | null
          recebedor_valores:
            | Database["public"]["Enums"]["recebedor_valores"]
            | null
          renavam: string | null
          seguradora: string | null
          seguro_validade: string | null
          situacao_cadastro: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_operacional: Database["public"]["Enums"]["situacao_operacional"]
          tag_numero: string | null
          tag_operadora_id: number | null
          tara_t: number | null
          tipo_assoalho: Database["public"]["Enums"]["tipo_assoalho"] | null
          tipo_veiculo_id: number
          uf_emplacamento: Database["public"]["Enums"]["uf"] | null
          ultimo_motorista_id: string | null
          unidade_operacional_id: number | null
          updated_at: string
          updated_by: string | null
          venc_ipva: string | null
          vl_compra: number | null
          vl_mercado: number | null
        }
        Insert: {
          altura_m?: number | null
          ano_fabricacao?: number | null
          ano_modelo?: number | null
          apolice?: string | null
          aquisicao?: string | null
          arrendado?: boolean | null
          capacidade_carga_t?: number | null
          centro_custo_id?: number | null
          chassi?: string | null
          cidade_emplacamento?: string | null
          cmt_t?: number | null
          comprimento_m?: number | null
          cor?: string | null
          created_at?: string
          created_by?: string | null
          dt_emissao_crlv?: string | null
          exercicio_doc?: number | null
          hp?: number | null
          id?: string
          km_inicial?: number | null
          largura_m?: number | null
          litros_tanque?: number | null
          marca_id?: number | null
          media_padrao_carregado?: number | null
          media_padrao_vazio?: number | null
          modelo?: string | null
          nr_certificado_doc?: string | null
          nr_frota?: string | null
          nr_motor?: string | null
          nr_registro_crlv?: string | null
          nr_seguranca_crlv?: string | null
          observacao?: string | null
          pbt_t?: number | null
          pgr_sm_automatica?: boolean | null
          placa: string
          potencia_motor?: string | null
          proprietario_documento_id: string
          proprietario_posse_id: string
          rastreador_empresa?: string | null
          rastreador_modelo?: string | null
          rastreador_numero?: string | null
          rastreador_observacao?: string | null
          rastreamento_tipo?:
            | Database["public"]["Enums"]["tipo_rastreamento"]
            | null
          recebedor_valores?:
            | Database["public"]["Enums"]["recebedor_valores"]
            | null
          renavam?: string | null
          seguradora?: string | null
          seguro_validade?: string | null
          situacao_cadastro?: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_operacional?: Database["public"]["Enums"]["situacao_operacional"]
          tag_numero?: string | null
          tag_operadora_id?: number | null
          tara_t?: number | null
          tipo_assoalho?: Database["public"]["Enums"]["tipo_assoalho"] | null
          tipo_veiculo_id: number
          uf_emplacamento?: Database["public"]["Enums"]["uf"] | null
          ultimo_motorista_id?: string | null
          unidade_operacional_id?: number | null
          updated_at?: string
          updated_by?: string | null
          venc_ipva?: string | null
          vl_compra?: number | null
          vl_mercado?: number | null
        }
        Update: {
          altura_m?: number | null
          ano_fabricacao?: number | null
          ano_modelo?: number | null
          apolice?: string | null
          aquisicao?: string | null
          arrendado?: boolean | null
          capacidade_carga_t?: number | null
          centro_custo_id?: number | null
          chassi?: string | null
          cidade_emplacamento?: string | null
          cmt_t?: number | null
          comprimento_m?: number | null
          cor?: string | null
          created_at?: string
          created_by?: string | null
          dt_emissao_crlv?: string | null
          exercicio_doc?: number | null
          hp?: number | null
          id?: string
          km_inicial?: number | null
          largura_m?: number | null
          litros_tanque?: number | null
          marca_id?: number | null
          media_padrao_carregado?: number | null
          media_padrao_vazio?: number | null
          modelo?: string | null
          nr_certificado_doc?: string | null
          nr_frota?: string | null
          nr_motor?: string | null
          nr_registro_crlv?: string | null
          nr_seguranca_crlv?: string | null
          observacao?: string | null
          pbt_t?: number | null
          pgr_sm_automatica?: boolean | null
          placa?: string
          potencia_motor?: string | null
          proprietario_documento_id?: string
          proprietario_posse_id?: string
          rastreador_empresa?: string | null
          rastreador_modelo?: string | null
          rastreador_numero?: string | null
          rastreador_observacao?: string | null
          rastreamento_tipo?:
            | Database["public"]["Enums"]["tipo_rastreamento"]
            | null
          recebedor_valores?:
            | Database["public"]["Enums"]["recebedor_valores"]
            | null
          renavam?: string | null
          seguradora?: string | null
          seguro_validade?: string | null
          situacao_cadastro?: Database["public"]["Enums"]["situacao_cadastro"]
          situacao_operacional?: Database["public"]["Enums"]["situacao_operacional"]
          tag_numero?: string | null
          tag_operadora_id?: number | null
          tara_t?: number | null
          tipo_assoalho?: Database["public"]["Enums"]["tipo_assoalho"] | null
          tipo_veiculo_id?: number
          uf_emplacamento?: Database["public"]["Enums"]["uf"] | null
          ultimo_motorista_id?: string | null
          unidade_operacional_id?: number | null
          updated_at?: string
          updated_by?: string | null
          venc_ipva?: string | null
          vl_compra?: number | null
          vl_mercado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "veiculo_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centro_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculo_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marca_veiculo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculo_proprietario_documento_id_fkey"
            columns: ["proprietario_documento_id"]
            isOneToOne: false
            referencedRelation: "proprietario"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "veiculo_proprietario_posse_id_fkey"
            columns: ["proprietario_posse_id"]
            isOneToOne: false
            referencedRelation: "proprietario"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "veiculo_tag_operadora_id_fkey"
            columns: ["tag_operadora_id"]
            isOneToOne: false
            referencedRelation: "operadora_tag"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculo_tipo_veiculo_id_fkey"
            columns: ["tipo_veiculo_id"]
            isOneToOne: false
            referencedRelation: "tipo_veiculo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculo_ultimo_motorista_id_fkey"
            columns: ["ultimo_motorista_id"]
            isOneToOne: false
            referencedRelation: "motorista"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "veiculo_ultimo_motorista_id_fkey"
            columns: ["ultimo_motorista_id"]
            isOneToOne: false
            referencedRelation: "v_motorista_situacao"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "veiculo_unidade_operacional_id_fkey"
            columns: ["unidade_operacional_id"]
            isOneToOne: false
            referencedRelation: "unidade_operacional"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_conjunto_capacidade: {
        Row: {
          capacidade_total_t: number | null
          cavalo_id: string | null
          cmt_t: number | null
          conjunto_id: string | null
          excede_cmt: boolean | null
          tara_total_t: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conjunto_cavalo_id_fkey"
            columns: ["cavalo_id"]
            isOneToOne: false
            referencedRelation: "veiculo"
            referencedColumns: ["id"]
          },
        ]
      }
      v_motorista_situacao: {
        Row: {
          cnh_validade: string | null
          cpf: string | null
          nome: string | null
          pessoa_id: string | null
          situacao_dados: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motorista_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: true
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pendencias_documentos: {
        Row: {
          arquivo_id: string | null
          descricao: string | null
          pessoa_id: string | null
          tipo_pendencia: string | null
          veiculo_id: string | null
        }
        Relationships: []
      }
      v_vencimentos: {
        Row: {
          arquivo_id: string | null
          data: string | null
          dias: number | null
          pessoa_id: string | null
          tipo: string | null
          veiculo_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      arquivo_restrito: { Args: { p_path: string }; Returns: boolean }
      auditar: { Args: { p_tabela: unknown }; Returns: undefined }
      capacidade_carga: {
        Args: { v: Database["public"]["Tables"]["veiculo"]["Row"] }
        Returns: number
      }
      cnpj_valido: { Args: { p: string }; Returns: boolean }
      cpf_valido: { Args: { p: string }; Returns: boolean }
      definir_perfil: {
        Args: {
          p_ativo: boolean
          p_nome: string
          p_papel: Database["public"]["Enums"]["app_papel"]
          p_user_id: string
        }
        Returns: undefined
      }
      eh_admin: { Args: never; Returns: boolean }
      encerrar_conjunto: { Args: { p_conjunto_id: string }; Returns: undefined }
      existe_arquivo_enviado: {
        Args: { p_pessoa_id: string; p_tipo: string; p_veiculo_id: string }
        Returns: boolean
      }
      listar_usuarios: {
        Args: never
        Returns: {
          ativo: boolean
          email: string
          nome: string
          papel: Database["public"]["Enums"]["app_papel"]
          ultimo_acesso: string
          user_id: string
        }[]
      }
      nomes_usuarios: {
        Args: { p_ids: string[] }
        Returns: {
          nome: string
          user_id: string
        }[]
      }
      normalizar_placa: { Args: { p: string }; Returns: string }
      papel_atual: {
        Args: never
        Returns: Database["public"]["Enums"]["app_papel"]
      }
      placa_valida: { Args: { p: string }; Returns: boolean }
      pode_editar: { Args: never; Returns: boolean }
      pode_ler: { Args: never; Returns: boolean }
      registrar_visualizacao: {
        Args: { p_arquivo: string }
        Returns: undefined
      }
      salvar_conjunto: {
        Args: {
          p_cavalo_id: string
          p_conjunto_id: string
          p_itens: string[]
          p_motorista_id: string
        }
        Returns: string
      }
      so_digitos: { Args: { p: string }; Returns: string }
      tem_papel: {
        Args: { p: Database["public"]["Enums"]["app_papel"][] }
        Returns: boolean
      }
      validar_conjunto: { Args: { p_conjunto: string }; Returns: undefined }
    }
    Enums: {
      app_papel: "admin" | "operacao" | "financeiro" | "leitura"
      categoria_cnh:
        | "provisoria"
        | "a"
        | "b"
        | "c"
        | "d"
        | "e"
        | "ab"
        | "ac"
        | "ad"
        | "ae"
      categoria_veiculo: "cavalo" | "caminhao" | "carreta" | "dolly" | "outros"
      configuracao_cavalo: "toco" | "trucado"
      desconto_inss: "nao" | "inss_sest_senat" | "sest_senat"
      enquadramento_antt: "etc" | "tac" | "ctc" | "etc_equiparado"
      estado_civil: "solteiro" | "casado" | "separado" | "viuvo" | "outro"
      grau_instrucao:
        | "fundamental_incompleto"
        | "fundamental_completo"
        | "medio_incompleto"
        | "medio_completo"
        | "superior_incompleto"
        | "superior_completo"
      raca_cor:
        | "branca"
        | "preta"
        | "parda"
        | "amarela"
        | "indigena"
        | "nao_informado"
      recebedor_valores: "motorista" | "proprietario" | "posto"
      regra_pgto_frete:
        | "peso_saida"
        | "peso_chegada"
        | "peso_chegada_se_menor"
        | "peso_chegada_com_tolerancia"
        | "peso_chegada_acima_tolerancia"
      sexo: "masculino" | "feminino"
      situacao_cadastro: "cancelado" | "pendente" | "normal"
      situacao_cpf:
        | "regular"
        | "titular_falecido"
        | "suspensa"
        | "pendente_regularizacao"
        | "cancelada_multiplicidade"
        | "nula"
        | "cancelada_oficio"
      situacao_gr: "sem_consulta" | "habilitado" | "vencido"
      situacao_operacional:
        | "ag_motorista"
        | "apreendido"
        | "arrendado"
        | "ativo"
        | "a_venda"
        | "devolvido"
        | "parado"
        | "sinistro"
        | "vendido"
      tipo_assoalho: "madeira" | "ferro" | "misto"
      tipo_chave_pix: "cpf" | "cnpj" | "celular" | "email" | "aleatoria"
      tipo_conta: "corrente" | "poupanca" | "salario"
      tipo_endereco:
        | "residencial"
        | "comercial"
        | "coleta_descarga"
        | "cobranca"
        | "correspondencia"
      tipo_pessoa: "pf" | "pj"
      tipo_rastreamento: "telemonitorado" | "rastreador" | "localizador"
      tipo_referencia: "pessoal" | "comercial"
      tipo_telefone: "residencial" | "comercial" | "celular" | "fax" | "radio"
      uf:
        | "AC"
        | "AL"
        | "AP"
        | "AM"
        | "BA"
        | "CE"
        | "DF"
        | "ES"
        | "GO"
        | "MA"
        | "MT"
        | "MS"
        | "MG"
        | "PA"
        | "PB"
        | "PR"
        | "PE"
        | "PI"
        | "RJ"
        | "RN"
        | "RS"
        | "RO"
        | "RR"
        | "SC"
        | "SP"
        | "SE"
        | "TO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_papel: ["admin", "operacao", "financeiro", "leitura"],
      categoria_cnh: [
        "provisoria",
        "a",
        "b",
        "c",
        "d",
        "e",
        "ab",
        "ac",
        "ad",
        "ae",
      ],
      categoria_veiculo: ["cavalo", "caminhao", "carreta", "dolly", "outros"],
      configuracao_cavalo: ["toco", "trucado"],
      desconto_inss: ["nao", "inss_sest_senat", "sest_senat"],
      enquadramento_antt: ["etc", "tac", "ctc", "etc_equiparado"],
      estado_civil: ["solteiro", "casado", "separado", "viuvo", "outro"],
      grau_instrucao: [
        "fundamental_incompleto",
        "fundamental_completo",
        "medio_incompleto",
        "medio_completo",
        "superior_incompleto",
        "superior_completo",
      ],
      raca_cor: [
        "branca",
        "preta",
        "parda",
        "amarela",
        "indigena",
        "nao_informado",
      ],
      recebedor_valores: ["motorista", "proprietario", "posto"],
      regra_pgto_frete: [
        "peso_saida",
        "peso_chegada",
        "peso_chegada_se_menor",
        "peso_chegada_com_tolerancia",
        "peso_chegada_acima_tolerancia",
      ],
      sexo: ["masculino", "feminino"],
      situacao_cadastro: ["cancelado", "pendente", "normal"],
      situacao_cpf: [
        "regular",
        "titular_falecido",
        "suspensa",
        "pendente_regularizacao",
        "cancelada_multiplicidade",
        "nula",
        "cancelada_oficio",
      ],
      situacao_gr: ["sem_consulta", "habilitado", "vencido"],
      situacao_operacional: [
        "ag_motorista",
        "apreendido",
        "arrendado",
        "ativo",
        "a_venda",
        "devolvido",
        "parado",
        "sinistro",
        "vendido",
      ],
      tipo_assoalho: ["madeira", "ferro", "misto"],
      tipo_chave_pix: ["cpf", "cnpj", "celular", "email", "aleatoria"],
      tipo_conta: ["corrente", "poupanca", "salario"],
      tipo_endereco: [
        "residencial",
        "comercial",
        "coleta_descarga",
        "cobranca",
        "correspondencia",
      ],
      tipo_pessoa: ["pf", "pj"],
      tipo_rastreamento: ["telemonitorado", "rastreador", "localizador"],
      tipo_referencia: ["pessoal", "comercial"],
      tipo_telefone: ["residencial", "comercial", "celular", "fax", "radio"],
      uf: [
        "AC",
        "AL",
        "AP",
        "AM",
        "BA",
        "CE",
        "DF",
        "ES",
        "GO",
        "MA",
        "MT",
        "MS",
        "MG",
        "PA",
        "PB",
        "PR",
        "PE",
        "PI",
        "RJ",
        "RN",
        "RS",
        "RO",
        "RR",
        "SC",
        "SP",
        "SE",
        "TO",
      ],
    },
  },
} as const
