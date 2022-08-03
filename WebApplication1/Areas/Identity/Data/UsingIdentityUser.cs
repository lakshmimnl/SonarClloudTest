using Microsoft.AspNetCore.Identity;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Threading.Tasks;

namespace WebApplication1.Areas.Identity.Data
{
    public class UsingIdentityUser: IdentityUser
    {
      
            [PersonalData]
            [Column(TypeName = "nvarchar(100)")]
            public string Firstname { get; set; }
            [PersonalData]
            [Column(TypeName = "nvarchar(100)")]
            public string LastName { get; set; }
        
    }
}
